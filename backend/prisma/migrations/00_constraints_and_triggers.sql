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
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CHECK CONSTRAINTS — Non-negative monetary amounts
-- ─────────────────────────────────────────────────────────────────────────────

-- Products
ALTER TABLE products ADD CONSTRAINT chk_product_base_price_positive
  CHECK (base_price >= 0);

-- Order totals
ALTER TABLE orders ADD CONSTRAINT chk_order_subtotal_positive CHECK (subtotal >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_order_shipping_positive CHECK (shipping_total >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_order_tax_positive CHECK (tax_total >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_order_grand_total_positive CHECK (grand_total >= 0);

-- Order items
ALTER TABLE order_items ADD CONSTRAINT chk_order_item_unit_price_positive
  CHECK (unit_price >= 0);
ALTER TABLE order_items ADD CONSTRAINT chk_order_item_line_total_positive
  CHECK (line_total >= 0);
ALTER TABLE order_items ADD CONSTRAINT chk_order_item_quantity_positive
  CHECK (quantity > 0);

-- Payments
ALTER TABLE payments ADD CONSTRAINT chk_payment_amount_positive CHECK (amount >= 0);

-- Ledger entries
ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_amount_positive CHECK (amount >= 0);

-- Escrow holds
ALTER TABLE escrow_holds ADD CONSTRAINT chk_escrow_amount_positive CHECK (amount >= 0);

-- Payouts
ALTER TABLE payouts ADD CONSTRAINT chk_payout_amount_positive CHECK (amount >= 0);

-- Refunds
ALTER TABLE refunds ADD CONSTRAINT chk_refund_amount_positive CHECK (amount >= 0);

-- Cart items
ALTER TABLE cart_items ADD CONSTRAINT chk_cart_item_quantity_positive CHECK (quantity > 0);
ALTER TABLE cart_items ADD CONSTRAINT chk_cart_item_price_positive
  CHECK (unit_price_snapshot >= 0);

-- Inventory
ALTER TABLE inventory ADD CONSTRAINT chk_inventory_available_non_negative
  CHECK (quantity_available >= 0);
ALTER TABLE inventory ADD CONSTRAINT chk_inventory_reserved_non_negative
  CHECK (quantity_reserved >= 0);

-- Reviews rating range
ALTER TABLE reviews ADD CONSTRAINT chk_review_rating_range CHECK (rating >= 1 AND rating <= 5);

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
