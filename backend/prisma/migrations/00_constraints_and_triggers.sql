-- =============================================================================
-- DentalMarket — Raw SQL: Extensions, Constraints, Indexes, Triggers
-- Run after Prisma initial migration via: prisma migrate dev
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS (should already exist from docker init, but idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. updated_at TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'roles', 'user_roles', 'seller_profiles', 'customer_profiles',
    'addresses', 'categories', 'certification_standards', 'certifications',
    'products', 'product_variants', 'inventory', 'product_images',
    'carts', 'cart_items', 'wishlists',
    'orders', 'order_items', 'shipments',
    'payments', 'escrow_holds', 'payouts', 'refunds',
    'disputes', 'reviews', 'notification_preferences'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CHECK CONSTRAINTS — Non-negative monetary amounts (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Products
  ALTER TABLE products ADD CONSTRAINT chk_product_base_price_positive CHECK (base_price >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT chk_order_subtotal_positive CHECK (subtotal >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT chk_order_shipping_positive CHECK (shipping_total >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT chk_order_tax_positive CHECK (tax_total >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT chk_order_grand_total_positive CHECK (grand_total >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE order_items ADD CONSTRAINT chk_order_item_unit_price_positive CHECK (unit_price >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE order_items ADD CONSTRAINT chk_order_item_line_total_positive CHECK (line_total >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE order_items ADD CONSTRAINT chk_order_item_quantity_positive CHECK (quantity > 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT chk_payment_amount_positive CHECK (amount >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_amount_positive CHECK (amount >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE escrow_holds ADD CONSTRAINT chk_escrow_amount_positive CHECK (amount >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE payouts ADD CONSTRAINT chk_payout_amount_positive CHECK (amount >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE refunds ADD CONSTRAINT chk_refund_amount_positive CHECK (amount >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE cart_items ADD CONSTRAINT chk_cart_item_quantity_positive CHECK (quantity > 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE cart_items ADD CONSTRAINT chk_cart_item_price_positive CHECK (unit_price_snapshot >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE inventory ADD CONSTRAINT chk_inventory_available_non_negative CHECK (quantity_available >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE inventory ADD CONSTRAINT chk_inventory_reserved_non_negative CHECK (quantity_reserved >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT chk_review_rating_range CHECK (rating >= 1 AND rating <= 5);
  EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PARTIAL INDEXES — Certification verification & expiry
-- ─────────────────────────────────────────────────────────────────────────────

-- Only verified certs (for fast "has valid cert?" lookups)
CREATE INDEX IF NOT EXISTS idx_cert_verified_only
  ON certifications (id)
  WHERE status = 'verified';

-- Expiry scan worker: find verified certs expiring soon
CREATE INDEX IF NOT EXISTS idx_cert_expiry_scan
  ON certifications (expiry_date)
  WHERE status = 'verified' AND expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ESCROW TERMINAL STATE CONSTRAINT
-- Guarantees a hold reaches exactly ONE terminal state (released OR refunded)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_terminal_state
  ON escrow_holds (id)
  WHERE status IN ('released', 'refunded');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. GIN INDEX on product attributes (category-specific specs)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_product_attributes_gin
  ON products USING GIN (attributes);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. APPEND-ONLY ENFORCEMENT — Deny UPDATE/DELETE on immutable tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION deny_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only. UPDATE and DELETE are not permitted.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ledger entries — the single source of financial truth; must never be mutated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_ledger_append_only'
  ) THEN
    CREATE TRIGGER enforce_ledger_append_only
      BEFORE UPDATE OR DELETE ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION deny_mutation();
  END IF;
END;
$$;

-- Certification verification audit trail — defensible compliance record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_cert_verify_append_only'
  ) THEN
    CREATE TRIGGER enforce_cert_verify_append_only
      BEFORE UPDATE OR DELETE ON certification_verifications
      FOR EACH ROW EXECUTE FUNCTION deny_mutation();
  END IF;
END;
$$;

-- Audit logs — governance trail; immutable by definition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_audit_log_append_only'
  ) THEN
    CREATE TRIGGER enforce_audit_log_append_only
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION deny_mutation();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CERTIFICATION-GATING CONSTRAINT
-- A product cannot transition to 'active' unless ALL required certification
-- standards for its category are satisfied by verified, unexpired certs.
-- This is defense-in-depth alongside the application-level check.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_product_certification_gating()
RETURNS TRIGGER AS $$
DECLARE
  required_ids UUID[];
  verified_count INT;
  required_count INT;
BEGIN
  -- Only enforce when status is transitioning TO 'active'
  IF NEW.status != 'active' OR (OLD IS NOT NULL AND OLD.status = 'active') THEN
    RETURN NEW;
  END IF;

  -- Get required standard IDs for this product's category
  SELECT c.required_standard_ids INTO required_ids
  FROM categories c
  WHERE c.id = NEW.category_id;

  -- If no required standards, allow activation
  IF required_ids IS NULL OR array_length(required_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  required_count := array_length(required_ids, 1);

  -- Count how many of the required standards have verified, unexpired certs
  SELECT COUNT(DISTINCT cert.standard_id) INTO verified_count
  FROM certifications cert
  WHERE cert.holder_type = 'product'
    AND cert.product_id = NEW.id
    AND cert.standard_id = ANY(required_ids)
    AND cert.status = 'verified'
    AND (cert.expiry_date IS NULL OR cert.expiry_date > CURRENT_DATE);

  IF verified_count < required_count THEN
    RAISE EXCEPTION
      'Product % cannot be activated: only %/% required certification standards are verified and unexpired.',
      NEW.id, verified_count, required_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_product_cert_gating'
  ) THEN
    CREATE TRIGGER enforce_product_cert_gating
      BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION enforce_product_certification_gating();
  END IF;
END;
$$;
