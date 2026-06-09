DentalMarket — Technical Specification & Architecture Blueprint
A multi-platform marketplace for certified dental equipment Web (React/Next.js) · Android (Kotlin) · iOS (Swift) · Unified Node.js backend




	

	Document type
	Production implementation blueprint
	Version
	1.0
	Status
	Ready for engineering kickoff
	Target market
	Uzbekistan / CIS, with cross-border readiness
	Comparable platforms
	Uzum Market, Yandex Market, Wildberries
	Audience
	Engineering, DevOps, Security, Product, Compliance
	

________________


How to read this document
This blueprint is written so that a development team can begin implementation immediately. It is organised top-down: business and domain context first, then architecture, then per-subsystem detail (database, APIs, features), then the cross-cutting disciplines (security, scalability, deployment, testing). Every major decision is stated explicitly with a rationale, because the differentiator of this platform is certification trust for regulated medical/dental devices, and that requirement shapes choices that a generic marketplace would make differently.


Two themes recur throughout and should be treated as first-class constraints, not afterthoughts:


1. Certification integrity. Dental equipment is a regulated medical-device category. Listings cannot be trusted on the seller's word; the platform's reason to exist is that every product and every seller carries verifiable certification. This drives the data model, the listing workflow, search/filter, and admin governance.
2. Data localisation & financial regulation. The launch market (Uzbekistan) requires personal data of citizens to be stored on infrastructure physically located in-country, and money-holding (escrow) touches local payment-aggregation and banking rules. Hosting and payment architecture are constrained accordingly.


________________


Table of contents
1. Executive summary
2. System architecture
3. Technology stack
4. Database schema
5. API design
6. User panels & dashboards
7. Core feature specifications
8. Security & compliance
9. Scalability & performance
10. Deployment strategy
11. Testing & error-handling strategy
12. Phased rollout plan
13. Appendices


________________


1. Executive summary
DentalMarket is a three-client marketplace (responsive web, native Android, native iOS) backed by a single API-first Node.js backend. It connects verified sellers of dental equipment — manufacturers, authorised distributors, and resellers — with professional buyers (clinics, dental laboratories, individual practitioners, procurement officers).


What separates it from a general-goods marketplace:


* Certification is a gate, not a badge. A product cannot be listed for sale until its required certifications (e.g., conformity marking, medical-device registration, electrical-safety standard for powered devices) are uploaded, validated, and approved. Sellers themselves are verified (legal-entity KYC, distributor authorisation) before they can transact.
* Buyers filter on certification. Search and filtering treat certification standard, validity, and issuing authority as primary facets alongside price, equipment type, and seller reputation.
* Money is held in escrow. Because order values are high and devices are regulated, buyer funds are held by the platform from capture until delivery confirmation (or auto-release), protecting both sides and giving the platform a controlled point for dispute and refund handling.
1.1 Primary actors
Actor
	Role
	Key surface
	Platform owner / Admin
	Governs the platform: approves sellers, verifies certifications, resolves disputes, oversees finances and compliance
	Admin Panel + Owner Financial Dashboard
	Seller
	Lists products, manages inventory and orders, uploads certifications, tracks earnings
	Seller Admin Panel + Seller Financial Module
	Customer / Buyer
	Browses, filters by certification, purchases, tracks orders, requests refunds, reviews
	Customer Panel (web + mobile) + Customer Financial Module
	System / Automated
	Auto-release escrow, expiry checks on certifications, notification dispatch, fraud signals
	Background workers
	1.2 Success criteria for the architecture
* A new engineer can clone, run, and understand a single service domain in under a day.
* Financial operations (capture, escrow hold, payout, refund) are ACID-consistent and fully auditable — no money movement without an immutable ledger entry.
* The catalogue and search scale to millions of SKUs and high read concurrency without touching the transactional database on the hot path.
* The mobile and web clients consume the same documented API; there is no client-specific backend logic that bypasses the contract.
* Compliance posture (data localisation, PCI-DSS scope minimisation, personal-data protection) is designed in, not retrofitted.


________________


2. System architecture
2.1 Architectural style
The backend is a modular monolith with hard internal domain boundaries, deployed as a small number of independently scalable processes, with a clear extraction path to microservices. This is a deliberate, pragmatic choice:


* A startup-stage marketplace does not benefit from the operational overhead of dozens of microservices on day one.
* Domain modules (auth, catalog, orders, payments, certification, etc.) are isolated behind internal service interfaces and own their own database schemas/tables, so any module can be extracted into a standalone service later without rewriting its consumers.
* Two concerns are split out from day one because they have fundamentally different scaling and runtime profiles: the search subsystem (read-heavy, eventually consistent) and the background worker pool (async, queue-driven).


Design rule: modules communicate through explicit in-process service interfaces or via the message bus — never by reaching directly into another module's tables. This is what makes later extraction cheap.
2.2 Component & data-flow diagram
flowchart TB


    subgraph Clients["Client layer"]


        WEB["Web app<br/>Next.js (SSR/ISR)"]


        IOS["iOS app<br/>Swift / SwiftUI"]


        AND["Android app<br/>Kotlin / Compose"]


    end


    subgraph Edge["Edge layer"]


        CDN["CDN<br/>(static, images, ISR pages)"]


        WAF["WAF + DDoS protection"]


        GW["API Gateway / Load Balancer<br/>(TLS termination, rate limiting, routing)"]


    end


    subgraph App["Application layer — modular monolith (stateless, horizontally scaled)"]


        AUTH["Auth & Identity"]


        USER["Users & Profiles"]


        CERT["Certification & Verification"]


        CAT["Catalog"]


        SRCH["Search API"]


        CART["Cart & Checkout"]


        ORD["Orders & Fulfilment"]


        PAY["Payments & Escrow Ledger"]


        DISP["Disputes & Refunds"]


        REV["Reviews & Reputation"]


        NOTIF["Notifications"]


        ADM["Admin / Governance"]


        RPT["Reporting / BI API"]


    end


    subgraph Async["Async processing"]


        MQ["Message bus<br/>(RabbitMQ / Kafka)"]


        WRK["Worker pool<br/>(notifications, escrow auto-release,<br/>cert-expiry scans, index sync,<br/>payout settlement)"]


    end


    subgraph Data["Data layer"]


        PG[("PostgreSQL<br/>primary + read replicas")]


        REDIS[("Redis<br/>cache, sessions, locks, rate limits")]


        ES[("OpenSearch / Elasticsearch<br/>product search index")]


        OBJ[("Object storage (S3-compatible)<br/>images, certification PDFs")]


        DWH[("Analytics store<br/>ClickHouse / warehouse")]


    end


    subgraph Ext["External integrations"]


        PSP["Payment processors<br/>Payme · Click · Uzcard/Humo · Stripe"]


        SMS["SMS gateway<br/>Eskiz / Play Mobile · Twilio"]


        MAIL["Email<br/>SES / SendGrid"]


        PUSH["Push<br/>FCM (Android) · APNs (iOS)"]


        KYC["KYC / identity verification"]


        CERTAPI["Certification authority<br/>registries / validators"]


        SHIP["Logistics / shipping"]


    end


    WEB --> CDN --> WAF --> GW


    IOS --> WAF


    AND --> WAF


    WAF --> GW


    GW --> AUTH & USER & CERT & CAT & SRCH & CART & ORD & PAY & DISP & REV & NOTIF & ADM & RPT


    CAT --> PG


    ORD --> PG


    PAY --> PG


    DISP --> PG


    USER --> PG


    CERT --> PG


    REV --> PG


    AUTH --> REDIS


    CART --> REDIS


    SRCH --> ES


    CERT --> OBJ


    CAT --> OBJ


    CAT -- index events --> MQ


    ORD -- order events --> MQ


    PAY -- ledger events --> MQ


    CERT -- expiry/verify events --> MQ


    MQ --> WRK


    WRK --> ES


    WRK --> NOTIF


    WRK --> PG


    WRK --> DWH


    PAY --> PSP


    NOTIF --> SMS & MAIL & PUSH


    USER --> KYC


    CERT --> CERTAPI


    ORD --> SHIP


    PG -. CDC / ETL .-> DWH


    RPT --> DWH


    RPT --> PG
2.3 Request lifecycle (read path vs. write path)
Read path (e.g., browsing a product): Client → CDN (cache hit for images/ISR pages) → API Gateway → Catalog/Search module → Redis cache → (on miss) read replica or OpenSearch. Product catalogue reads never block on the primary database and are heavily cached.


Write path (e.g., placing an order): Client → API Gateway → Order module → transaction on the primary PostgreSQL (orders, order items, escrow ledger entries written atomically) → emit order.created to the message bus → workers fan out notifications, search-index updates, and analytics ingestion asynchronously. The user-facing response returns as soon as the durable transaction commits; everything downstream is eventually consistent.
2.4 Escrow & order data flow
This sequence is the financial heart of the platform and is specified precisely because correctness here is non-negotiable.


sequenceDiagram


    autonumber


    participant C as Customer


    participant API as Order/Payment module


    participant L as Escrow Ledger (PostgreSQL)


    participant PSP as Payment processor


    participant S as Seller


    participant W as Worker (auto-release)


    C->>API: Place order (cart → checkout)


    API->>L: Create order (PENDING_PAYMENT) + ledger intent


    API->>PSP: Initiate payment (authorise + capture)


    PSP-->>API: Capture success (webhook, idempotent)


    API->>L: Record CAPTURE; create ESCROW_HOLD (HELD); order → PAID


    API->>S: Notify "new paid order — ship now"


    S->>API: Mark SHIPPED (+ tracking)


    API->>C: Notify "shipped" + tracking


    C->>API: Confirm delivery


    alt Buyer confirms (or auto-confirm after N days)


        API->>L: RELEASE escrow → split: seller payout + platform commission


        W-->>L: (fallback) auto-release after timeout if no dispute


        API->>S: Notify "funds released / payout scheduled"


    else Dispute opened before release


        C->>API: Open dispute


        API->>L: Freeze escrow (DISPUTED); engage dispute workflow


        Note over API,L: Resolution → full release, partial refund, or full refund


    end


Key invariants enforced in code and database constraints:


* Every state transition of money (intent → capture → hold → release/refund) writes an append-only ledger row; balances are derived, never overwritten.
* Payment-processor webhooks are idempotent (deduplicated by processor event ID) — a webhook delivered twice never double-captures or double-releases.
* Escrow funds cannot be released and refunded for the same hold; a single terminal transition is enforced by a state machine plus a unique partial index.


________________


3. Technology stack
The stack below is the production target. Where a regional choice differs from the global default (payments, SMS, hosting), both are listed because the launch market is Uzbekistan but the platform is built cross-border-ready.
3.1 Stack summary
Layer
	Technology
	Rationale
	Web frontend
	React 18 + Next.js 14 (App Router), TypeScript
	SSR/ISR for SEO-critical product and category pages; React Server Components reduce client JS; one framework for marketing + app surfaces.
	Web styling/UI
	Tailwind CSS + Radix UI primitives + a shared design-token package
	Accessible primitives, consistent theming, fast iteration.
	Web state/data
	TanStack Query (server cache) + Zustand (local UI state)
	Clean separation of server state vs. client state; request dedupe and caching out of the box.
	iOS
	Swift 5.9+, SwiftUI (UIKit interop where needed), Swift Concurrency (async/await)
	Native performance; SwiftUI for velocity; structured concurrency for networking.
	Android
	Kotlin, Jetpack Compose, Coroutines + Flow
	Modern declarative UI; coroutines for async; parity with iOS architecture.
	Backend runtime
	Node.js 20 LTS, Express (TypeScript), structured as a modular monolith
	Requested stack; Express with a disciplined module layout. See §3.3 for the structure that keeps Express maintainable at scale.
	API contract
	OpenAPI 3.1 (REST), with an optional GraphQL BFF for mobile (Phase 4)
	Contract-first; generated client SDKs and typed server stubs.
	Primary database
	PostgreSQL 16
	ACID guarantees for orders/payments/escrow; rich types (JSONB, arrays, ranges), strong indexing, partitioning, logical replication.
	Cache / sessions / locks
	Redis 7
	Session store, response cache, rate-limit counters, distributed locks (escrow auto-release), hot inventory counters.
	Search
	OpenSearch / Elasticsearch 8
	Faceted certification/equipment-type search, typo tolerance, relevance tuning, aggregations.
	Object storage
	S3-compatible (AWS S3, or in-region provider)
	Product images and certification documents; presigned upload/download URLs; lifecycle rules.
	Message bus
	RabbitMQ (Phase 1–2) → Kafka (Phase 4 at scale)
	Async fan-out for events; RabbitMQ is simpler to operate early, Kafka for high-throughput event streaming and analytics later.
	Analytics store
	ClickHouse (or managed warehouse: BigQuery/Redshift)
	Columnar store for BI dashboards and financial reporting at query speed, isolated from OLTP.
	Background jobs
	BullMQ (Redis-backed) for jobs; consumers for bus events
	Retries, backoff, scheduling (cron-like) for cert-expiry scans and escrow auto-release.
	Containerisation
	Docker; Kubernetes for orchestration (managed: EKS/GKE or in-region)
	Horizontal scaling, rolling deploys, self-healing.
	IaC
	Terraform
	Reproducible, reviewable infrastructure; environment parity.
	CI/CD
	GitHub Actions (or GitLab CI); Fastlane for mobile
	Automated test → build → deploy pipelines per platform.
	Observability
	OpenTelemetry traces, Prometheus + Grafana (metrics), Loki/ELK (logs), Sentry (errors)
	Correlated logs/metrics/traces; alerting on SLOs.
	Secrets
	HashiCorp Vault or cloud KMS-backed secret manager
	No secrets in code or images; rotation.
	3.2 Regional integration choices
Capability
	Uzbekistan / CIS
	International / cross-border
	Card & wallet payments
	Payme, Click, Uzcard, Humo
	Stripe / Adyen
	SMS / OTP
	Eskiz.uz, Play Mobile
	Twilio
	Email
	Amazon SES (eu/me region) or local relay
	SES / SendGrid / Postmark
	Push
	FCM (Android), APNs (iOS)
	Same
	Maps / address
	Yandex Maps
	Google Maps / Mapbox
	Hosting
	In-country data centre / regional cloud for personal data (see §8 data localisation)
	Cloud region nearest market
	

A payment abstraction layer wraps all processors behind one internal PaymentProvider interface (authorize, capture, refund, payout, verifyWebhook). Adding or swapping a processor is a new adapter, not a change to order/escrow logic.
3.3 Keeping an Express monolith maintainable
Express alone imposes no structure; without discipline a large Express app degrades into spaghetti. This project enforces structure through layout and conventions:


/src


  /modules


    /auth         # routes, controllers, services, repositories, dto, events


    /users


    /catalog


    /certification


    /search


    /cart


    /orders


    /payments     # provider adapters live here behind PaymentProvider


    /disputes


    /reviews


    /notifications


    /admin


    /reporting


  /shared


    /db           # Prisma client, migrations, transaction helpers


    /events       # message-bus publisher/consumer abstractions


    /errors       # AppError hierarchy, error codes


    /middleware   # auth guard, RBAC, validation, rate limit, request-id


    /config       # typed env loading (zod-validated)


    /telemetry    # logging, tracing, metrics


  /workers        # background consumers + scheduled jobs


  app.ts          # express assembly, route mounting


  server.ts       # bootstrap


Conventions that hold the structure together:


* Per-module layering: route → controller → service → repository. Controllers never touch the database; repositories never contain business rules.
* Validation at the boundary with Zod schemas; nothing untyped enters a service.
* ORM: Prisma for type-safe data access and migrations. Raw SQL is permitted in repositories for performance-critical or window-function-heavy reporting queries.
* Cross-module calls go through a module's exported service interface, never its repository — preserving the extraction path to microservices.
* (Optional) For teams that prefer a more opinionated framework while keeping Node/TypeScript, NestJS maps cleanly onto this same module layout and provides DI and structure out of the box; it is a drop-in alternative to bare Express if the team wants stronger conventions.
3.4 Shared mobile architecture (iOS + Android parity)
Both apps follow the same layered architecture so features ship to parity and the codebases reason alike:


Concern
	iOS (Swift)
	Android (Kotlin)
	UI
	SwiftUI
	Jetpack Compose
	Presentation
	MVVM (ObservableObject view models)
	MVVM (ViewModel + StateFlow)
	Async
	Swift Concurrency (async/await, actors)
	Coroutines + Flow
	Networking
	URLSession + generated client from OpenAPI
	Retrofit + OkHttp + generated client
	Local persistence (offline)
	SwiftData / Core Data
	Room
	Dependency injection
	Swift's built-in / Factory
	Hilt (Dagger)
	Image loading/cache
	Kingfisher / Nuke
	Coil
	Secure storage (tokens)
	Keychain
	EncryptedSharedPreferences / Keystore
	Push
	APNs
	FCM
	Navigation
	NavigationStack
	Navigation Compose
	

A shared OpenAPI specification generates typed API clients for both platforms, eliminating drift between mobile networking code and the backend contract.


________________


4. Database schema
PostgreSQL is the system of record. The schema below covers the core entities; reference/lookup tables and join tables are noted inline. Conventions: every table has id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), and updated_at timestamptz NOT NULL DEFAULT now() (the latter maintained by trigger). Soft-deletable entities carry deleted_at timestamptz NULL. Monetary amounts are stored as BIGINT minor units (tiyin/cents) plus a currency CHAR(3) ISO-4217 code — never floating point.
4.1 Entity-relationship diagram
erDiagram


    USERS ||--o| SELLER_PROFILES : "has (if seller)"


    USERS ||--o| CUSTOMER_PROFILES : "has (if customer)"


    USERS ||--o{ ADDRESSES : owns


    USERS ||--o{ USER_ROLES : "assigned"


    ROLES ||--o{ USER_ROLES : "granted via"


    SELLER_PROFILES ||--o{ PRODUCTS : lists


    SELLER_PROFILES ||--o{ CERTIFICATIONS : "holds (seller-level)"


    PRODUCTS ||--o{ CERTIFICATIONS : "holds (product-level)"


    PRODUCTS }o--|| CATEGORIES : "in"


    CATEGORIES ||--o{ CATEGORIES : "parent of"


    CERTIFICATION_STANDARDS ||--o{ CERTIFICATIONS : "instance of"


    CERTIFICATIONS ||--o{ CERTIFICATION_VERIFICATIONS : "audited by"


    PRODUCTS ||--o{ PRODUCT_VARIANTS : "has"


    PRODUCT_VARIANTS ||--o{ INVENTORY : "stocked as"


    PRODUCTS ||--o{ PRODUCT_IMAGES : "shows"


    USERS ||--o{ CARTS : has


    CARTS ||--o{ CART_ITEMS : contains


    PRODUCT_VARIANTS ||--o{ CART_ITEMS : "referenced by"


    USERS ||--o{ WISHLISTS : has


    WISHLISTS ||--o{ WISHLIST_ITEMS : contains


    USERS ||--o{ ORDERS : "places (buyer)"


    ORDERS ||--o{ ORDER_ITEMS : contains


    PRODUCT_VARIANTS ||--o{ ORDER_ITEMS : "ordered as"


    SELLER_PROFILES ||--o{ ORDER_ITEMS : "fulfils"


    ORDERS ||--|| SHIPMENTS : "shipped via"


    ORDERS ||--|| PAYMENTS : "paid by"


    PAYMENTS ||--o{ LEDGER_ENTRIES : "records"


    PAYMENTS ||--o| ESCROW_HOLDS : "held in"


    ESCROW_HOLDS ||--o{ PAYOUTS : "released to"


    SELLER_PROFILES ||--o{ PAYOUTS : receives


    PAYMENTS ||--o{ REFUNDS : "refunded by"


    ORDERS ||--o{ DISPUTES : "may raise"


    DISPUTES ||--o{ DISPUTE_MESSAGES : "discussed in"


    DISPUTES ||--o| REFUNDS : "may resolve to"


    ORDER_ITEMS ||--o| REVIEWS : "reviewed by"


    USERS ||--o{ REVIEWS : writes


    SELLER_PROFILES ||--o{ SELLER_RATINGS : "rated by aggregate"


    USERS ||--o{ NOTIFICATIONS : receives


    USERS ||--o{ AUDIT_LOGS : "subject of"
4.2 Identity & access
users — one row per human/account regardless of role.


Column
	Type
	Notes
	id
	UUID PK
	

	email
	citext UNIQUE
	case-insensitive
	phone
	varchar(20) UNIQUE NULL
	E.164; primary login in-region
	password_hash
	text
	Argon2id
	email_verified_at
	timestamptz NULL
	

	phone_verified_at
	timestamptz NULL
	

	mfa_enabled
	boolean DEFAULT false
	enforced for admin/seller
	mfa_secret
	text NULL (encrypted)
	TOTP seed
	status
	enum(active,suspended,pending,banned)
	

	locale
	varchar(10) DEFAULT ru-UZ
	

	last_login_at
	timestamptz NULL
	

	

roles (admin, seller, customer, support, finance, compliance) and user_roles (join, user_id + role_id, unique) implement RBAC. Fine-grained permissions are stored as a permissions JSONB on the role or in a role_permissions table for larger permission sets.


seller_profiles — business identity for sellers (1:1 with a user that has the seller role).


Column
	Type
	Notes
	id
	UUID PK
	

	user_id
	UUID FK→users UNIQUE
	

	legal_name
	text
	registered entity name
	tax_id
	varchar(50)
	INN/STIR
	registration_number
	varchar(50)
	company registry no.
	seller_type
	enum(manufacturer,authorised_distributor,reseller)
	gates which certifications are required
	country
	char(2)
	ISO-3166
	kyc_status
	enum(unsubmitted,pending,approved,rejected)
	gate to sell
	kyc_reviewed_by
	UUID FK→users NULL
	admin who reviewed
	payout_account
	jsonb (tokenised)
	bank/wallet for settlements
	commission_rate_bps
	int
	basis points; overrides default
	rating_avg
	numeric(3,2) DEFAULT 0
	denormalised from reviews
	rating_count
	int DEFAULT 0
	

	status
	enum(onboarding,active,paused,suspended)
	

	

customer_profiles — buyer details (clinic/lab/individual): organization_name, practice_license_no (optional, for regulated-buyer verification), default_currency, default_shipping_address_id.


addresses — user_id, type(shipping/billing), recipient, line1/line2, city, region, postal_code, country, geo (lat/lng), is_default.
4.3 Catalogue & certification (the domain core)
categories — self-referencing tree (parent_id NULL for roots). Dental-specific taxonomy, e.g. Imaging (intraoral sensors, CBCT, panoramic), Chairs & units, Handpieces & motors, Sterilisation (autoclaves), Lab equipment, Consumables, Surgical. Fields: slug UNIQUE, name (i18n via name_i18n JSONB), path (materialised path for fast subtree queries), required_standard_ids (array — which certification standards are mandatory to list in this category).


certification_standards — reference data for the certification regimes the platform recognises.


Column
	Type
	Example values
	id
	UUID PK
	

	code
	varchar(40) UNIQUE
	CE_MDR, FDA_510K, ISO_13485, IEC_60601, EAEU_TR, UZ_MOH_REG
	name
	text
	"EU Medical Device Regulation (CE)"
	category
	enum(product,quality_system,electrical_safety,registration)
	

	issuing_region
	varchar(40)
	EU, US, EAEU, UZ, ISO
	validator_type
	enum(manual,registry_api,third_party)
	how it can be verified
	validator_config
	jsonb NULL
	endpoint/lookup config when automatable
	

certifications — a concrete certificate held by either a seller or a product. This is the most important table on the platform.


Column
	Type
	Notes
	id
	UUID PK
	

	holder_type
	enum(seller,product)
	polymorphic owner
	holder_id
	UUID
	seller_profile.id or product.id
	standard_id
	UUID FK→certification_standards
	

	certificate_number
	varchar(120)
	

	issued_by
	text
	notified body / authority
	issue_date
	date
	

	expiry_date
	date NULL
	NULL = no expiry
	document_object_key
	text
	S3 key of the uploaded PDF/scan
	document_sha256
	char(64)
	integrity hash of the stored file
	status
	enum(pending,verified,rejected,expired,revoked)
	

	verified_by
	UUID FK→users NULL
	admin/compliance reviewer
	verified_at
	timestamptz NULL
	

	verification_method
	enum(manual,registry_api,third_party)
	

	rejection_reason
	text NULL
	

	notes
	text NULL
	

	

Indexes: (holder_type, holder_id), (standard_id), partial index WHERE status='verified', and (expiry_date) WHERE status='verified' to drive the daily expiry-scan worker (auto-transitions to expired and notifies the seller + delists affected products).


certification_verifications — append-only audit trail of every verification attempt/decision: certification_id, actor_id (admin or system), method, result(pass/fail/inconclusive), evidence JSONB (registry response, reviewer note), created_at. This gives compliance a defensible record of why each certificate was accepted.


products — a listing. A product cannot be set to active/listed unless every standard in its category's required_standard_ids is satisfied by a verified certification whose expiry_date is in the future. This rule is enforced both by application logic and by a database-level check (a trigger or a guarded state transition), so no code path can list an uncertified device.


Column
	Type
	Notes
	id
	UUID PK
	

	seller_id
	UUID FK→seller_profiles
	

	category_id
	UUID FK→categories
	

	sku
	varchar(64)
	seller-scoped unique
	title
	text (+ title_i18n jsonb)
	

	description
	text (+ i18n)
	

	brand
	text
	

	model
	text
	

	attributes
	jsonb
	category-specific specs (voltage, dimensions, etc.)
	status
	enum(draft,pending_review,active,paused,rejected,delisted)
	

	base_price
	bigint (minor units)
	

	currency
	char(3)
	

	rating_avg
	numeric(3,2) DEFAULT 0
	denormalised
	rating_count
	int DEFAULT 0
	

	published_at
	timestamptz NULL
	

	

product_variants (e.g., model configurations), inventory (variant_id, quantity_available, quantity_reserved, low_stock_threshold, warehouse_location), and product_images (object_key, position, alt, is_primary) complete the listing.
4.4 Cart, wishlist
carts (per user; guest carts keyed in Redis and merged on login), cart_items (variant_id, quantity, unit_price_snapshot). wishlists / wishlist_items mirror this for saved items.
4.5 Orders & fulfilment
orders — note a single buyer order may contain items from multiple sellers; line-level seller attribution lives on order_items, and escrow is tracked per payment with per-seller release.


Column
	Type
	Notes
	id
	UUID PK
	

	order_number
	varchar(20) UNIQUE
	human-friendly, sequential per day
	buyer_id
	UUID FK→users
	

	status
	enum(pending_payment,paid,processing,shipped,delivered,completed,cancelled,refunded,disputed)
	

	currency
	char(3)
	

	subtotal / shipping_total / tax_total / grand_total
	bigint
	minor units
	shipping_address_id
	UUID FK→addresses
	

	billing_address_id
	UUID FK→addresses
	

	placed_at
	timestamptz
	

	

order_items — order_id, variant_id, seller_id, quantity, unit_price, line_total, commission_bps_snapshot, fulfilment_status(per-line), delivery_confirmed_at. Storing the commission rate as a snapshot ensures historical orders are not retroactively repriced when rates change.


shipments — order_id, carrier, tracking_number, status, shipped_at, estimated_delivery, delivered_at.
4.6 Payments, escrow & the financial ledger
This cluster is append-only and double-entry-inspired so the platform can always reconstruct who owes whom.


payments — one per order checkout.


Column
	Type
	Notes
	id
	UUID PK
	

	order_id
	UUID FK→orders UNIQUE
	

	provider
	varchar(30)
	payme/click/uzcard/humo/stripe
	provider_payment_id
	text
	id at the processor
	amount
	bigint / currency char(3)
	

	status
	enum(initiated,authorized,captured,failed,partially_refunded,refunded)
	

	method
	enum(card,wallet,bank_transfer)
	

	idempotency_key
	text UNIQUE
	guards double-submit
	

ledger_entries — append-only, the single source of financial truth. Every money movement is one or more entries.


Column
	Type
	Notes
	id
	UUID PK
	

	payment_id
	UUID FK→payments
	

	entry_type
	enum(capture,escrow_hold,escrow_release,commission,payout,refund,reversal,adjustment)
	

	account
	enum(buyer,escrow,seller_payable,platform_revenue,processor)
	the logical account affected
	direction
	enum(debit,credit)
	

	amount
	bigint / currency char(3)
	

	related_party_id
	UUID NULL
	seller_id for payouts/commission
	external_ref
	text NULL
	processor settlement ref
	created_at
	timestamptz
	immutable
	

Balances (escrow held, seller payable, platform revenue) are computed by summing ledger entries, never stored as a mutable field. A nightly reconciliation job sums ledger balances against processor settlement reports and raises an alert on any drift.


escrow_holds — payment_id, order_item_id (per-seller granularity), amount, status(held,released,refunded,disputed), auto_release_at (timestamp the worker uses when the buyer never confirms), released_at. A unique partial index guarantees a hold reaches exactly one terminal state.


payouts — seller_id, amount, currency, status(scheduled,processing,paid,failed), provider_payout_id, period_start/period_end, statement_object_key (generated settlement statement). refunds — payment_id, order_item_id NULL, amount, reason, status(requested,approved,processing,completed,rejected), dispute_id NULL, processed_by.
4.7 Disputes & refunds
disputes — order_id, order_item_id NULL, raised_by (buyer), against (seller_id), type(not_received,not_as_described,damaged,counterfeit_or_uncertified,other), status(open,under_review,awaiting_buyer,awaiting_seller,resolved_release,resolved_partial_refund,resolved_full_refund,closed), assigned_admin_id, resolution_notes, opened_at, resolved_at, SLA due_at. The counterfeit_or_uncertified type is dental-specific and triggers a compliance review of the product's certifications.


dispute_messages — threaded communication with evidence attachments: dispute_id, sender_id, body, attachments (object keys), visibility(all/internal), created_at.
4.8 Reviews & reputation
reviews — tied to a verified purchase: order_item_id UNIQUE (one review per purchased item), author_id, product_id, seller_id, rating (1–5), title, body, status(published,pending_moderation,removed), seller_response, verified_purchase (always true given the FK). Aggregate ratings on products and seller_profiles are recomputed by a worker on review changes.
4.9 Notifications & audit
notifications — user_id, channel(email,sms,push,in_app), template_key, payload jsonb, status(queued,sent,delivered,failed,read), sent_at, read_at. notification_preferences — per user, per category opt-in/out (transactional notifications cannot be fully disabled).


audit_logs — append-only governance trail for sensitive actions (cert verification, dispute resolution, payout approval, role changes, refunds): actor_id, action, entity_type, entity_id, before/after jsonb, ip, user_agent, created_at. Retained per the data-retention policy in §8.
4.10 Indexing, partitioning & integrity summary
* Hot read indexes: products(category_id, status), products(seller_id, status), GIN on products.attributes, order_items(seller_id), ledger_entries(payment_id), notifications(user_id, status).
* Partitioning: ledger_entries, notifications, and audit_logs are range-partitioned by month (high-volume, append-heavy, time-queried). orders partitioned by month once volume warrants.
* Referential integrity: enforced with foreign keys; financial tables additionally guarded by CHECK constraints (non-negative amounts, currency consistency within an order) and state-machine-guarded transitions.
* Concurrency: inventory decrement uses SELECT ... FOR UPDATE or atomic conditional updates to prevent overselling; escrow release uses an advisory lock keyed on the hold ID.


________________


5. API design
5.1 Conventions
* Style: REST over HTTPS, JSON. Base path /api/v1. Versioned in the URL so v2 can run alongside v1 during client migrations.
* Contract-first: the OpenAPI 3.1 document is the source of truth; server stubs and typed client SDKs (web, iOS, Android) are generated from it. No undocumented endpoints.
* Authentication: OAuth2-style password/refresh flow issuing short-lived JWT access tokens (~15 min) + rotating refresh tokens (stored hashed, revocable, in Redis/DB). Access tokens carry sub, roles, scopes. Mobile stores tokens in Keychain/Keystore; web uses httpOnly secure cookies for the refresh token. MFA (TOTP) required for admin, finance, compliance, and enforced-optional for seller.
* Authorisation: RBAC guard middleware checks role + resource ownership on every protected route (a seller may only mutate their own products/orders; a buyer only their own orders).
* Idempotency: all unsafe POSTs that move money or create orders require an Idempotency-Key header; the server dedupes for 24h.
* Pagination: cursor-based (?cursor=&limit=) for large/changing collections (catalogue, orders, ledger); responses include next_cursor.
* Filtering/sorting: documented query params; complex catalogue search is delegated to the search endpoints (§7.2).
* Rate limiting: per-IP and per-user token-bucket limits at the gateway; stricter buckets on auth, checkout, and review endpoints.
* Errors: uniform envelope (see §11.4) with stable machine-readable code, human message, optional details[], and a request_id for support correlation.
* Webhooks (inbound): processor callbacks hit /api/v1/webhooks/payments/:provider, signature-verified and idempotent.
5.2 Shared / public & auth endpoints
Method & path
	Purpose
	Auth
	POST /auth/register
	Create account (customer or seller-intent)
	public
	POST /auth/login
	Email/phone + password → tokens
	public
	POST /auth/otp/request · POST /auth/otp/verify
	Phone OTP login/verify
	public
	POST /auth/token/refresh
	Rotate access token
	refresh token
	POST /auth/logout
	Revoke refresh token
	auth
	POST /auth/mfa/enroll · POST /auth/mfa/verify
	TOTP setup/verify
	auth
	POST /auth/password/forgot · POST /auth/password/reset
	Recovery
	public
	GET /me · PATCH /me
	Current profile
	auth
	GET /categories · GET /categories/:slug
	Category tree
	public
	GET /certification-standards
	List recognised standards (for filters)
	public
	5.3 Customer-facing endpoints
Method & path
	Purpose
	GET /products
	List/browse (filters: category, price range, brand, seller)
	GET /products/:id
	Product detail incl. verified certifications + seller rating
	GET /search
	Faceted search (see §7.2) — query, certification standard, equipment type, price, rating
	GET /search/suggest
	Autocomplete
	GET /sellers/:id
	Public seller storefront + reputation + certifications
	GET /cart · POST /cart/items · PATCH /cart/items/:id · DELETE /cart/items/:id
	Cart management
	POST /checkout/quote
	Price/shipping/tax quote before payment
	POST /orders
	Place order (idempotent) → returns payment intent
	GET /orders · GET /orders/:id
	Buyer order history & detail
	POST /orders/:id/confirm-delivery
	Confirm receipt → triggers escrow release
	POST /orders/:id/cancel
	Cancel (pre-shipment)
	GET /wishlist · POST /wishlist/items · DELETE /wishlist/items/:id
	Wishlist
	POST /payments/:id/pay
	Submit/confirm payment via chosen provider
	POST /disputes · GET /disputes · GET /disputes/:id · POST /disputes/:id/messages
	Open & manage disputes
	POST /refunds (request) · GET /refunds/:id
	Request & track refunds
	POST /reviews · GET /products/:id/reviews
	Leave/read reviews (verified purchase only)
	GET /me/reports/orders · GET /me/reports/refunds
	Customer financial module (history, receipts, refund status)
	GET /me/notifications · PATCH /me/notifications/:id/read · PATCH /me/notification-preferences
	Notifications
	GET /me/invoices/:orderId
	Download invoice/receipt (PDF)
	5.4 Seller endpoints (/seller/*, role: seller)
Method & path
	Purpose
	POST /seller/onboarding · GET /seller/onboarding/status
	Submit KYC / track approval
	POST /seller/certifications · GET /seller/certifications · DELETE /seller/certifications/:id
	Upload & manage seller-level certifications
	POST /seller/products · PATCH /seller/products/:id · DELETE /seller/products/:id
	Manage listings (draft → submit for review)
	POST /seller/products/:id/certifications
	Attach product-level certifications
	POST /seller/products/:id/images (presigned)
	Upload images
	PATCH /seller/products/:id/inventory
	Stock levels
	GET /seller/orders · GET /seller/orders/:id
	Incoming orders for this seller
	POST /seller/orders/:id/ship
	Mark shipped + tracking
	POST /seller/orders/:id/cancel
	Cancel with reason
	GET /seller/disputes · POST /seller/disputes/:id/respond
	Respond to disputes
	GET /seller/payouts · GET /seller/payouts/:id/statement
	Settlement statements
	GET /seller/reports/sales · GET /seller/reports/financials · GET /seller/reports/performance
	Seller financial & performance modules (revenue, units, AOV, escrow held, commission, refunds, conversion)
	POST /seller/reviews/:id/respond
	Public response to a review
	5.5 Admin / platform-owner endpoints (/admin/*, role: admin / compliance / finance)
Method & path
	Purpose
	GET /admin/users · PATCH /admin/users/:id/status
	User management, suspend/ban
	GET /admin/sellers/pending · POST /admin/sellers/:id/kyc-decision
	Approve/reject seller KYC
	GET /admin/certifications/pending · POST /admin/certifications/:id/verify
	Certification verification queue (approve/reject with evidence)
	GET /admin/products/pending · POST /admin/products/:id/moderate
	Listing moderation
	GET /admin/disputes · POST /admin/disputes/:id/assign · POST /admin/disputes/:id/resolve
	Dispute resolution (release / partial / full refund)
	GET /admin/refunds/pending · POST /admin/refunds/:id/decision
	Refund approvals
	GET /admin/payouts · POST /admin/payouts/:id/approve
	Payout oversight
	GET /admin/ledger · GET /admin/reconciliation
	Financial oversight & reconciliation status
	GET /admin/reviews/flagged · POST /admin/reviews/:id/moderate
	Review moderation
	GET /admin/reports/revenue · GET /admin/reports/gmv · GET /admin/reports/platform-health
	Owner financial & BI dashboard (GMV, net revenue, take rate, volume, dispute/refund rates, active sellers/buyers)
	GET /admin/audit-logs
	Governance / compliance audit trail
	POST /admin/categories · PATCH /admin/categories/:id
	Taxonomy + required-standard configuration
	POST /admin/standards · PATCH /admin/standards/:id
	Manage certification standards & validators
	5.6 Example payloads
Open a dispute — POST /api/v1/disputes


{


  "order_id": "0b6c…",


  "order_item_id": "9f12…",


  "type": "counterfeit_or_uncertified",


  "description": "Autoclave serial does not match the registration on the certificate.",


  "attachments": ["uploads/disputes/tmp/abc123.jpg"]


}


Response 201:


{


  "id": "d-4a7e…",


  "status": "open",


  "type": "counterfeit_or_uncertified",


  "sla_due_at": "2026-06-12T09:00:00Z",


  "request_id": "req_01HX…"


}


Verify a certification (admin) — POST /api/v1/admin/certifications/:id/verify


{


  "decision": "verified",


  "verification_method": "registry_api",


  "evidence": { "registry": "UZ_MOH", "lookup_id": "REG-2025-3391", "matched": true },


  "notes": "Registration confirmed against Ministry of Health registry."


}


________________


6. User panels & dashboards
All panels consume the same API (§5). The web admin/seller panels are built as authenticated areas of the Next.js app; the customer experience spans web + both mobile apps.
6.1 Admin panel (platform owner)
The governance cockpit. Modules:


* Dashboard / platform health — live KPIs: GMV today/MTD, active orders, escrow balance, open disputes, certification queue depth, system status (uptime, error rate, payment success rate).
* User management — search/filter users, view activity, suspend/ban with reason, reset MFA, impersonate-for-support (audited).
* Seller governance — KYC review queue with document viewer; approve/reject with reason; set per-seller commission; pause/suspend sellers.
* Certification verification queue — the core compliance workflow: side-by-side document viewer + registry-lookup panel, approve/reject with mandatory evidence; every decision written to certification_verifications and audit_logs. Expiring/expired certificates surfaced proactively.
* Listing moderation — review submitted products; a product can't go live until its certifications are verified and it passes moderation.
* Dispute resolution centre — queue with SLA timers, full message thread + evidence, escrow status, one-click resolution actions (release to seller / partial refund / full refund) that drive the ledger.
* Financial oversight — ledger explorer, reconciliation dashboard (ledger vs. processor settlements), payout approval, commission configuration.
* Compliance & audit — searchable audit log, data-subject request handling (export/erasure), retention status.
* Catalogue configuration — category tree, per-category required certification standards, recognised standards & their validators.


Access is role-scoped within admin: compliance sees certification/dispute/audit; finance sees ledger/payouts/reconciliation; admin (superuser) sees all.
6.2 Seller admin panel
* Dashboard — sales today/MTD, units sold, pending orders to ship, escrow held (incoming), payout schedule, low-stock alerts, store rating, open disputes.
* Inventory & listings — create/edit products, manage variants and stock, bulk upload (CSV) with validation, image management, listing status pipeline (draft → pending review → active).
* Certification documentation — upload/manage seller- and product-level certificates, see verification status and expiry countdowns, re-upload on rejection.
* Order fulfilment — order queue, print packing slips, mark shipped with tracking, manage cancellations/returns.
* Financial reporting (seller module) — revenue and units over time, AOV, commission deducted, escrow held vs. released, payouts and downloadable settlement statements, refunds/chargebacks, tax/VAT summary.
* Performance analytics — listing views, conversion rate, search impression share, rating trend, dispute rate vs. platform benchmark.
* Reviews — read and respond to customer reviews.
6.3 Customer panel (web + mobile)
* Browse & discover — category navigation, curated/featured, recently viewed.
* Search & filter by certification — the differentiator: filter and sort by certification standard, validity, equipment type, price range, brand, seller rating; certification badges shown on cards and detail pages with a "view certificate" affordance.
* Product detail — specs, images, verified certification panel (standard, issuer, validity), seller reputation, reviews.
* Cart & checkout — multi-currency display, multiple payment methods, address book, order quote (shipping/tax) before pay.
* Orders & tracking — order history, live status, shipment tracking, confirm delivery, reorder.
* Wishlist — save and track items.
* Disputes & refunds — open a dispute, message thread with evidence upload, request and track refunds.
* Financial module (customer) — order history with amounts, downloadable invoices/receipts, refund status and history, payment-method spend overview.
* Support & notifications — in-app notifications, preferences, help/contact.
6.4 Financial reporting dashboard (multi-stakeholder)
A single reporting subsystem serves three audiences with strict data isolation — each stakeholder sees only their slice. All three are powered by read models in the analytics store (§9), never querying the OLTP database on the hot path.


Module
	Audience
	Key reports & metrics
	Seller financials
	Seller
	Gross sales, net of commission, units, AOV; escrow held → released timeline; payouts & settlement statements; refunds/chargebacks; VAT summary; period-over-period trends.
	Customer financials
	Buyer
	Order history with totals; itemised invoices/receipts (PDF); refund status & history; spend by category and payment method.
	Owner / platform financials & BI
	Platform owner
	GMV, net revenue (commissions + fees), take rate, transaction count & volume, escrow float; active sellers/buyers (DAU/MAU), new vs. returning; conversion funnel; dispute rate, refund rate, chargeback rate; category and cohort performance; settlement/reconciliation status; platform-health (uptime, latency, payment success).
	

Each report supports date-range selection, currency normalisation (a daily FX-rate snapshot is stored so historical figures are reproducible), CSV/Excel/PDF export, and — for the owner — scheduled email digests. Authorisation is enforced server-side at the query layer: a seller's report query is always constrained to their seller_id; a buyer's to their user_id.


________________


7. Core feature specifications
7.1 Seller verification & certification validation
The platform's trust guarantee rests here. Two layers:


Seller verification (KYC). On onboarding a seller submits legal entity details (registration number, tax ID), beneficial-owner identity, and — depending on seller_type — manufacturer credentials or distributor authorisation letters. Documents are stored in object storage (private bucket, server-side encrypted). A KYC provider can be integrated for automated identity/business checks; otherwise compliance reviews manually. Sellers cannot list or transact until kyc_status = approved.


Certification validation workflow:


1. Seller uploads a certificate (PDF/scan) for a standard; the file's SHA-256 is recorded and the document stored privately.
2. The certificate enters the verification queue with status pending.
3. Verification proceeds by validator_type:
   * registry_api — the system queries the issuing authority's registry (where an API/lookup exists) and matches certificate number, holder, and validity; the registry response is stored as evidence.
   * manual — a compliance officer reviews the document against the issuer and records a decision + notes.
   * third_party — delegated to an accredited verification partner.
4. Decision (verified/rejected) is written, with evidence, to certification_verifications and audit_logs.
5. A product becomes listable only when all standards required by its category are satisfied by verified, unexpired certifications (enforced in code and by a guarded state transition).
6. A daily expiry-scan worker transitions soon-to-expire/expired certificates, notifies the seller, and auto-delists any product left without complete valid certification.


Anti-fraud signals: duplicate certificate numbers across sellers, mismatched holder names, re-uploaded files with identical hashes under different sellers — all flagged for compliance.
7.2 Multi-tier search & advanced filtering
Search runs on OpenSearch, kept in sync from PostgreSQL via index-sync workers consuming product.* and certification.* events (near-real-time; full reindex job available).


Indexed fields & facets: title/description (analysed, multilingual ru/uz/en analysers), brand, model, category path, price, seller rating, and certification facets — certification_standards (which verified standards the product carries), certification validity, issuing region. Equipment-type and category facets come from the taxonomy.


Capabilities:


* Full-text with typo tolerance (fuzzy) and synonym lists (dental terminology, e.g., "autoclave" ↔ "steriliser").
* Faceted filtering: multi-select certification standards, equipment type/category, price range (range query), brand, seller rating threshold, in-stock only, seller.
* Sorting: relevance, price asc/desc, rating, newest, best-selling (popularity signal fed from order events).
* Autocomplete/suggest endpoint with prefix + popular-query boosting.
* Relevance tuning: boost in-stock, higher-rated sellers, and products with stronger certification coverage; demote paused/low-stock.
* Results return only active, in-policy listings; certification badges are precomputed into the index for fast card rendering.
7.3 Payments, multi-currency & escrow
Multi-currency. Catalogue prices have an explicit currency; the buyer sees prices in their preferred display currency converted via a daily FX-rate snapshot (stored, so historical orders/reports are reproducible), but settlement currency is fixed per order at checkout to avoid FX ambiguity. Supported display currencies include UZS, USD, RUB, EUR.


Payment methods via the provider abstraction (§3.2): in-region cards/wallets (Payme, Click, Uzcard, Humo) and international cards (Stripe/Adyen). Each is an adapter implementing authorize / capture / refund / payout / verifyWebhook.


Escrow. On capture, funds enter the platform's escrow account and an escrow_hold (status held) is created with an auto_release_at timer. Funds release to the seller (minus commission, both written as ledger entries) when the buyer confirms delivery or the auto-release timer fires with no open dispute. If a dispute is open, the hold is frozen until resolution.


Regulatory note: holding client funds (escrow) and aggregating payments in the launch market typically requires working with a licensed payment aggregator or partner bank and may require a payment-services licence. The architecture supports either model — platform-operated escrow account, or a payment-provider that offers split/marketplace payouts — selected per the legal structure finalised before launch. This is flagged as a Phase-0 legal dependency, not an engineering blocker.


Reliability: all processor webhooks are signature-verified and idempotent; capture/refund/payout calls carry idempotency keys; a reconciliation job matches ledger balances to processor settlement reports nightly and alerts on drift.
7.4 Dispute resolution & refund management
* A buyer opens a dispute against an order item within an eligibility window; the relevant escrow hold freezes immediately, blocking release.
* The dispute is a structured, SLA-tracked case with a threaded message log and evidence attachments, visible to buyer, seller, and assigned admin (with internal-only notes).
* A counterfeit_or_uncertified dispute additionally re-opens compliance review of the product's certifications and can trigger delisting.
* Admin resolution is one of: release to seller, partial refund (split escrow), or full refund — each materialised as ledger entries and, for refunds, a processor refund call. Outcomes notify both parties.
* Standalone refunds (no dispute, e.g., seller-approved return) follow requested → approved → processing → completed, also ledgered.
* SLA timers and escalation: unactioned disputes escalate to senior support; metrics (dispute rate, resolution time) feed the owner dashboard and seller performance benchmarks.
7.5 Rating, review & seller reputation
* Reviews are purchase-verified (tied to a delivered order_item), one per item, rated 1–5 with title/body and optional images.
* Reviews pass automated moderation (profanity/spam heuristics) and may be queued for manual moderation; sellers can post one public response per review.
* Seller reputation is a composite recomputed by a worker: weighted average rating (recency-weighted), order-completion rate, on-time-shipment rate, dispute rate, and response time. This score feeds search ranking and is shown on storefronts.
* Anti-abuse: rate-limited submissions, one-review-per-purchase enforcement, anomaly detection on rating spikes.
7.6 Notification system (email · SMS · push · in-app)
* A single notification service renders templated, localised (ru/uz/en) messages and dispatches across channels per user notification_preferences; transactional notifications (payment, shipment, dispute, security) cannot be disabled, marketing can.
* Channels: email (SES/SendGrid), SMS/OTP (Eskiz/Play Mobile in-region, Twilio international), push (FCM Android, APNs iOS), and in-app feed.
* Event-driven: workers consume domain events (order.paid, order.shipped, dispute.opened, certification.expiring, payout.completed, …) and enqueue notifications with retry/backoff and delivery-status tracking.
* Device tokens are registered per user/device; stale tokens pruned on delivery failure.
7.7 Analytics & BI
* Domain events and CDC from PostgreSQL feed the analytics store (ClickHouse/warehouse), where star-schema read models power the stakeholder dashboards (§6.4) without touching OLTP.
* Product analytics (views, funnel, search terms) captured via a lightweight events pipeline.
* The owner dashboard exposes GMV, revenue, take rate, conversion, retention/cohorts, dispute/refund rates, and category performance; sellers get their scoped performance view; data scientists/PhD-grade analysis can query the warehouse directly under governed access.
7.8 Mobile offline capabilities
Native apps degrade gracefully without connectivity:


* Cached browsing: recently viewed products, last-seen catalogue pages, and category tree cached locally (Room / SwiftData) with images cached by Coil/Kingfisher; served read-only when offline with a clear "offline — last updated …" indicator.
* Persistent local state: cart and wishlist persist locally and sync on reconnect (last-write-wins with server reconciliation; price re-validated at checkout).
* Queued actions: non-financial actions composed offline (e.g., drafting a review, saving to wishlist) are queued and replayed when connectivity returns.
* Hard online-only operations: checkout, payment, escrow confirmation, and dispute submission require connectivity by design — these touch money and must hit the authoritative server; the UI states this explicitly rather than queuing them.
* Sync uses delta endpoints (updated-since cursors) and respects auth-token refresh on resume.


________________


8. Security & compliance
Security is designed in. The platform handles regulated-device certifications, personal data of clinics/practitioners, and money — three high-stakes surfaces.
8.1 Data protection & localisation (critical constraint)
* Data localisation (launch market): Uzbekistan's personal-data law requires personal data of citizens to be processed and stored using databases physically located in-country. Therefore the primary datastore holding personal data (and its backups) is hosted on in-country infrastructure; cross-border services that touch personal data must be assessed against this requirement. Non-personal/derived analytics may live elsewhere if no personal data leaves the jurisdiction. This shapes the hosting decision and is a Phase-0 item.
* GDPR-aligned practices (for EU sellers/buyers and good hygiene): lawful basis & consent records, data-subject rights (access/export/rectification/erasure) implemented via admin tooling, data-processing records, breach-notification runbook, privacy-by-design and data minimisation.
* Retention & deletion: documented retention per data class (e.g., financial/ledger records retained per tax law; audit logs retained for the compliance window; marketing data shorter). Erasure requests honour legal-hold exceptions (e.g., transaction records that must be retained).
8.2 Encryption
* In transit: TLS 1.3 everywhere (clients↔edge, edge↔services, services↔datastores); HSTS; modern cipher suites only; certificate pinning in mobile apps for the API host.
* At rest: AES-256 full-disk/volume encryption on databases, backups, and object storage. Particularly sensitive fields (MFA secrets, payout account details, KYC document references) are additionally application-layer encrypted with keys held in a KMS/Vault.
* Key management: KMS-backed keys with rotation; no plaintext secrets in code, images, or env files — all injected from a secrets manager at runtime.
8.3 Payment security (PCI-DSS)
* Scope minimisation: the platform never stores or transmits raw card data. Card entry is delegated to the payment processors' hosted fields / SDKs / redirect flows; only tokens return to the platform. This keeps PCI-DSS scope at the lighter SAQ A / SAQ A-EP tier rather than full processing scope.
* TLS for all payment interactions; signed, idempotent webhooks; least-privilege access to payment configuration; quarterly review of processor integrations.
8.4 Authentication & authorisation
* Argon2id password hashing; breached-password checks on set; account-lockout/backoff on brute force.
* MFA (TOTP) mandatory for admin/finance/compliance, enforced-optional for sellers; recovery codes.
* Short-lived JWT access tokens + rotating, revocable refresh tokens; device/session management with remote revoke.
* RBAC with resource-ownership checks on every mutation; principle of least privilege; admin sub-roles (§6.1).
* Sensitive admin actions (impersonation, payout approval, certification decisions, refunds) are step-up-authenticated and fully audited.
8.5 Application & infrastructure security
* OWASP Top 10 mitigations: input validation (Zod) at every boundary; parameterised queries via the ORM (no SQL injection); output encoding + CSP to prevent XSS; CSRF protection on cookie-auth web flows; SSRF guards on any URL fetch; secure file-upload handling (type/size validation, AV scanning of uploaded certificates/evidence, served from an isolated bucket/domain).
* Edge protection: WAF + DDoS mitigation; per-IP and per-user rate limiting; bot/abuse detection on auth, checkout, and review endpoints.
* Secrets & supply chain: dependency scanning (SCA), SAST in CI, container image scanning, signed images, SBOM; least-privilege IAM; private networking between tiers; databases not publicly reachable.
* Audit & monitoring: append-only audit_logs for governance actions; centralised security logging; anomaly alerts (impossible-travel logins, payout spikes); incident-response runbook with severity tiers and escalation.
* Backups & DR: encrypted automated backups, point-in-time recovery on PostgreSQL, periodic restore drills; documented RPO/RTO (target RPO ≤ 15 min, RTO ≤ 1 h for tier-1 services).
8.6 Compliance documentation & standards mapping
Maintained as living artefacts in the repo/wiki and reviewed each release:


Area
	Standard / requirement
	Where addressed
	Payments
	PCI-DSS (SAQ A / A-EP)
	§8.3 — tokenised, no card storage
	Personal data (local)
	Uzbekistan personal-data law (localisation)
	§8.1 — in-country primary store
	Personal data (EU)
	GDPR-aligned rights & records
	§8.1 — DSAR tooling, RoPA
	Medical-device trust
	Cert validation & audit trail
	§4.3, §7.1 — verified certifications + certification_verifications
	Quality (device sellers)
	ISO 13485 (sellers, as applicable)
	recorded as a recognised standard, verified per §7.1
	App security
	OWASP ASVS / Top 10
	§8.5
	Data integrity (finance)
	Append-only ledger + reconciliation
	§4.6, §7.3
	Auditability
	Immutable audit logs, retention
	§4.9, §8.1
	

Legal counsel must confirm the precise medical-device, payment-services, and data-protection obligations for each operating jurisdiction before launch; engineering implements to the confirmed requirements. Standards listed are the recognised set the platform is built to validate against, not legal advice.


________________


9. Scalability & performance
The system is designed so the read-heavy catalogue/search path scales independently of the consistency-critical financial path.
9.1 Scaling strategy by tier
* Stateless app tier: API processes hold no session state (sessions/tokens in Redis), so they scale horizontally behind the load balancer with autoscaling on CPU/latency/queue-depth. The search subsystem and the worker pool scale on their own metrics.
* Database tier:
   * Read replicas serve catalogue/reporting reads; the primary takes writes only. The app routes queries (reads→replica, writes→primary) with read-your-writes care on critical flows.
   * Connection pooling via PgBouncer to bound connections under high concurrency.
   * Partitioning of high-volume append tables (ledger_entries, notifications, audit_logs, eventually orders) by month; old partitions archived.
   * Sharding is deferred; the modular boundaries mean the highest-volume domain (e.g., catalogue) can be split to its own database first if needed.
* Search tier: OpenSearch cluster scales by adding nodes/shards; the index is rebuildable from PostgreSQL, so it is treated as a derived store.
* Async tier: message bus + workers absorb spikes (order bursts, notification fan-out) and smooth load on the database; consumers scale by partition/queue.
9.2 Caching & CDN
* Multi-layer caching:
   * CDN edge-caches static assets, product images, and ISR-rendered catalogue/product pages.
   * Redis caches hot reads (category tree, product detail projections, search facets, FX snapshot) with cache-aside + explicit invalidation on product.updated/certification.verified events.
   * HTTP caching headers (ETag, Cache-Control) on cacheable GETs.
* Image pipeline: uploaded images are processed into responsive sizes/formats (WebP/AVIF) and served via CDN; certification PDFs are private (presigned, short-TTL URLs), never CDN-cached.
* Cache correctness: financial and order data are never served stale from cache; caching is confined to catalogue/search/reference data.
9.3 Performance targets (SLOs)
Surface
	Target
	Catalogue/search read (p95)
	< 300 ms server-side
	Product detail (p95, cached)
	< 200 ms
	Checkout/order write (p95)
	< 800 ms (excl. processor latency)
	Search index freshness
	< 30 s after source change
	Core service availability
	99.9% monthly
	Payment webhook processing
	idempotent, < 2 s, with retry
	9.4 Resilience patterns
* Circuit breakers + timeouts + retries with backoff on all external calls (processors, SMS/email, registries); failures degrade gracefully (e.g., queue the notification, surface a retryable error at checkout).
* Bulkheads: a slow external dependency (e.g., an SMS provider) cannot exhaust resources needed by checkout.
* Graceful degradation: if search is unavailable, fall back to basic category browse from PostgreSQL; if images CDN is degraded, serve placeholders.
* Load & capacity testing (k6/JMeter) against catalogue browse, search, and checkout before each major launch; capacity headroom maintained at ≥ 40% at expected peak.


________________


10. Deployment strategy
10.1 Environments & infrastructure-as-code
Four environments — local → dev → staging → production — provisioned by Terraform for parity. Staging mirrors production topology (including in-region data placement) for realistic testing. All infrastructure changes go through code review.
10.2 Backend & web deployment
* Containers on Kubernetes (managed cluster in the required region): separate deployments for the API, the worker pool, and the search-sync consumers, each independently scalable.
* Rolling / blue-green deploys with readiness/liveness probes and automatic rollback on health-check failure; database migrations run as gated, backward-compatible steps (expand-then-contract) so deploys don't require downtime.
* Web (Next.js): containerised on the same cluster, or on a managed edge platform (e.g., Vercel) if data-localisation constraints permit for non-personal rendering; static/ISR assets fronted by the CDN.
* Config & secrets injected at runtime from the secrets manager; no environment-specific code.
10.3 Mobile deployment (iOS & Android)
* CI/CD with Fastlane drives build, sign, test, and store submission for both platforms.
* iOS: automated signing & provisioning; beta via TestFlight; phased App Store release; minimum iOS version policy documented.
* Android: signed app bundles (AAB) via Play Console; staged rollout (e.g., 5% → 20% → 100%) with crash-rate gating; internal/closed/open testing tracks.
* Versioning & compatibility: semantic app versions; the API is versioned (/v1) and backward-compatible within a major version, so older app builds keep working during staged rollouts. A force-upgrade mechanism (server-driven minimum-version flag) handles breaking changes gracefully.
* Feature flags (server-driven) decouple release from deploy and enable safe progressive rollout across web and mobile simultaneously.
* Crash & performance monitoring (Sentry/Crashlytics) per platform with release-health dashboards.
10.4 CI/CD pipeline (per push)
lint + typecheck → unit tests → build → integration tests (ephemeral DB/Redis)


→ security scans (SAST, SCA, image scan) → contract tests (OpenAPI)


→ deploy to staging → E2E + smoke tests → manual/automated gate → production (progressive)


* Trunk-based development with short-lived branches; required green checks + review to merge.
* Ephemeral preview environments per pull request for web/API where feasible.
* Database migration safety checks block destructive migrations without an approved plan.


________________


11. Testing & error-handling strategy
11.1 Testing pyramid
Level
	Backend (Node/TS)
	Web (Next.js)
	iOS (Swift)
	Android (Kotlin)
	Unit
	Jest/Vitest — services, domain rules, ledger math
	Vitest + React Testing Library
	XCTest
	JUnit + Robolectric
	Integration
	Supertest against app with ephemeral PostgreSQL + Redis (Testcontainers)
	Component + API-mock integration
	XCTest with stubbed networking
	Instrumented + Hilt test modules
	Contract
	OpenAPI schema validation; provider/consumer (Pact) so clients & server stay in sync
	generated-client conformance
	generated-client conformance
	generated-client conformance
	E2E
	—
	Playwright (browse → search → checkout → dispute)
	XCUITest
	Espresso / Maestro
	Load/perf
	k6 / JMeter on catalogue, search, checkout
	Lighthouse / Web Vitals budgets
	—
	—
	Security
	SAST, SCA, DAST, periodic pen test
	same
	mobile app pen test
	mobile app pen test
	11.2 Critical test focus (domain-specific, non-negotiable)
* Financial correctness: property/scenario tests asserting ledger invariants — captures, holds, releases, commissions, refunds always net to zero per the double-entry model; no path produces a negative escrow balance; partial-refund splits are exact to the minor unit.
* Idempotency: duplicate webhooks, retried checkouts, and replayed payout calls never double-charge, double-release, or double-refund.
* Certification gating: a product cannot reach active without complete, verified, unexpired certifications — tested at the API and database-constraint level; expiry-scan correctly delists.
* Authorisation matrix: automated tests prove a seller cannot read/mutate another seller's orders/products, a buyer cannot access others' orders, and admin sub-roles are correctly scoped.
* Concurrency: inventory cannot oversell under parallel checkout (race tests); escrow release is single-terminal under concurrent confirm + auto-release.
11.3 Quality gates
* Coverage thresholds enforced in CI (e.g., ≥ 80% lines on the backend, with 100% on the payment/escrow/ledger module); merges blocked below threshold.
* All E2E + smoke suites green on staging before production promotion.
* Synthetic monitoring runs the critical user journeys against production continuously and pages on failure.
11.4 Error-handling strategy
Uniform error envelope returned by the API:


{


  "error": {


    "code": "ESCROW_ALREADY_RELEASED",


    "message": "Funds for this order have already been released.",


    "details": [],


    "request_id": "req_01HX…"


  }


}


* Stable error codes (machine-readable) decoupled from human messages, so clients branch on code and localise message.
* Centralised error middleware maps a typed AppError hierarchy (validation, auth, not-found, conflict, rate-limit, dependency-failure, internal) to correct HTTP status; unexpected errors return a generic 500 without leaking internals, while the full stack + context is logged.
* Validation errors (400) enumerate offending fields in details[].
* Correlation: every request carries a request_id (propagated through logs, traces, and the error envelope) so support can trace one user's failure end-to-end.
* External-dependency failures surface as retryable errors with backoff; user-facing copy distinguishes "try again" (transient) from "action needed" (e.g., payment declined).
* Client-side: web and mobile show actionable, localised messages, retain unsaved input, support retry, and report unexpected errors to Sentry/Crashlytics with the request_id attached.
* Observability: structured JSON logs (no PII/secret leakage), metrics on error rates per endpoint, distributed tracing across modules and external calls; alerting on SLO breaches (error-rate, latency, payment-success-rate, reconciliation drift).
* Dead-letter queues capture non-processable async messages for inspection and replay; failed notifications/payouts are retried then escalated.


________________


12. Phased rollout plan
A pragmatic sequence that ships value early while front-loading the legal and trust foundations. Indicative durations assume a small cross-functional team; adjust to staffing.
Phase 0 — Foundations & legal dependencies (parallel, blocking for launch)
* Legal: confirm medical-device, payment-services/escrow, and data-protection obligations per jurisdiction; choose the escrow/payment-licensing model; confirm in-country hosting for personal data.
* Platform: Terraform baseline, Kubernetes cluster (in-region), CI/CD skeleton, PostgreSQL/Redis, secrets manager, observability stack, OpenAPI repo + codegen, auth/identity (RBAC, MFA).
Phase 1 — MVP marketplace (web first)
* Core data model; seller onboarding + KYC; certification upload & manual verification; catalogue & listings with certification gating; basic search/filter; cart/checkout; one regional payment provider + escrow with the ledger; orders & fulfilment; customer + seller panels (essential); transactional notifications (email/SMS). Goal: real transactions with verified certifications on web.
Phase 2 — Trust, disputes & finance depth
* Dispute resolution + refund management; admin governance console (full); registry-API certification validation where available; reviews & seller reputation; multi-provider payments + multi-currency display; reconciliation job; certification expiry automation; seller/customer/owner financial dashboards (v1).
Phase 3 — Native mobile apps
* iOS (Swift/SwiftUI) and Android (Kotlin/Compose) consuming the same API: browse, search-by-certification, checkout, orders/tracking, disputes, notifications (push), and offline browsing/cart/wishlist sync. Staged store rollouts with force-upgrade and feature flags.
Phase 4 — Scale, BI & integrations
* Analytics store + advanced BI/owner dashboards (cohorts, funnels, take-rate); search relevance tuning; performance hardening (read replicas, partitioning, caching expansion); RabbitMQ→Kafka if throughput requires; public/partner API for ERP/procurement integrations; optional GraphQL BFF for mobile efficiency.
Phase 5 — Expansion
* Additional jurisdictions/currencies/payment rails; deeper logistics integrations; advanced fraud/risk; recommendation & merchandising; further compliance certifications as the business requires.


Sequencing principle: certification trust and financial correctness are built in Phases 1–2 before mobile and scale — because they are the platform's reason to exist, and retrofitting them is far costlier than building on them.


________________


13. Appendices
13.1 Order & escrow state machines
stateDiagram-v2


    [*] --> pending_payment


    pending_payment --> paid: payment captured


    pending_payment --> cancelled: buyer cancels / timeout


    paid --> processing: seller accepts


    processing --> shipped: seller ships


    shipped --> delivered: carrier delivered


    delivered --> completed: buyer confirms / auto-release


    paid --> disputed: dispute opened


    processing --> disputed


    shipped --> disputed


    delivered --> disputed


    disputed --> completed: resolved (release)


    disputed --> refunded: resolved (full refund)


    disputed --> processing: resolved (partial, continue)


    paid --> refunded: pre-ship refund


    completed --> [*]


    cancelled --> [*]


    refunded --> [*]


Escrow hold: held → released (terminal) | held → refunded (terminal) | held → disputed → released | refunded. Exactly one terminal state per hold, enforced by state machine + unique partial index.
13.2 Glossary
Term
	Meaning
	GMV
	Gross Merchandise Value — total value of goods sold through the platform.
	Take rate
	Platform net revenue ÷ GMV.
	Escrow
	Buyer funds held by the platform from capture until delivery confirmation/release.
	Ledger entry
	Append-only record of a single money movement; balances are summed from these.
	EAC / EVM
	Estimate-at-completion / earned-value metrics (relevant if seller-side project reporting is added later).
	Certification standard
	A recognised regime (e.g., CE/MDR, FDA 510(k), ISO 13485, IEC 60601, EAEU TR, local MoH registration) a product/seller is validated against.
	RBAC
	Role-Based Access Control.
	CDC
	Change Data Capture — streaming DB changes to the analytics store.
	DSAR / RoPA
	Data-Subject Access Request / Record of Processing Activities.
	ISR / SSR
	Incremental Static Regeneration / Server-Side Rendering (Next.js).
	BFF
	Backend-for-Frontend — a client-tailored API layer.
	13.3 Open decisions to confirm before/early in Phase 0
1. Escrow legal model — platform-operated escrow account vs. provider marketplace-payouts (drives licensing).
2. Hosting provider meeting in-country data-localisation for personal data.
3. Primary payment provider for Phase 1 (Payme / Click / Uzcard-Humo) and integration mode (hosted fields vs. redirect).
4. KYC provider for automated seller verification, or manual-only at launch.
5. Certification registries with programmatic lookup vs. manual-only standards.
6. Analytics store choice (self-hosted ClickHouse vs. managed warehouse).
7. Express vs. NestJS for the backend framework (same module layout either way).


________________




End of specification. This blueprint is implementation-ready for engineering kickoff; the open decisions in §13.3 and the Phase-0 legal dependencies should be resolved in parallel with foundation work so they do not block Phase 1.