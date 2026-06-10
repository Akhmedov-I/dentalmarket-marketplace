# Agent Task — Web Frontend Audit, Completion & Hardening (DentalMarket)

**Input:** the DentalMarket repository and `DentalMarket_Technical_Specification.md` v1.0 (the contract). This task covers the **Next.js web application only** — spec §3.1 (web stack), §6 (panels & dashboards), §7 (feature UX), §9.2 (web performance), §11 (web testing). Mobile apps are a separate task.

**Relationship to the main verify-and-deploy task:** run this after that task's Phase 2 (backend gaps closed), in parallel with or before its deployment phases. On completion, patch the main task's Definition of Done with one line: *"`FRONTEND_GAP_REPORT.md` shows zero open BLOCKER/MAJOR and `SCREENS.md` is complete"* — and extend its Phase-5 smoke with the per-panel render checks from Phase F4 below.

Work the phases in order. Do not start a later phase while a `BLOCKER` from an earlier one is open.

---

## Ground rules (frontend-specific)

1. **The UI never bypasses the contract.** All data access goes through the generated OpenAPI client wrapped in TanStack Query. No hand-rolled `fetch` with hand-typed response shapes. If a screen needs data the API doesn't expose, that is an API gap — record it, don't improvise.  
2. **UI hiding is not security.** Route guards and hidden menu items are convenience only; for every restricted action, verify the server enforces it (expect a 403 and render it gracefully). Never ship a screen that *relies* on client-side hiding.  
3. **No money math in the client.** Prices arrive as BIGINT minor units \+ currency; the client only formats for display (locale-aware, correct for UZS/USD/RUB/EUR). No floating-point arithmetic on amounts anywhere in the web codebase.  
4. **No hardcoded user-facing strings.** Everything through the i18n layer with `ru`, `uz`, `en` keys; `ru` \+ `en` fully translated, `uz` keys scaffolded. Add a lint rule that fails CI on raw JSX strings.  
5. **Fix screens, not checks.** Failing accessibility, console-error, or budget checks are defects in the UI, never reasons to relax the gate.  
6. State discipline per spec §3.1: TanStack Query owns server state (with cache invalidation on mutations — e.g., certification verified ⇒ product status refetches); Zustand only for local UI state. Styling via Tailwind \+ Radix primitives and the shared design-token package — consistent visual system, not default-template output.

---

## Phase F1 — Screen inventory against spec §6 → `FRONTEND_GAP_REPORT.md`

Enumerate the implemented App Router routes and map them against this required-screen matrix. For every screen record: **exists? · wired to the live API (no inline mock data)? · handles loading / empty / error states? · responsive (desktop-optimized, usable at 768 px)? · i18n-compliant?** — then assign severity (`BLOCKER` \= a §6 module absent or unusable; `MAJOR` \= present but unwired/missing states; `MINOR` \= polish).

**Customer surface:** home; category browse; search results with working facets (certification standard multi-select, equipment type/category, price range, brand, seller-rating threshold, in-stock) and sort; autocomplete; product detail with the **verified-certification panel** (standard, issuer, validity, "view certificate" via short-TTL presigned URL) and seller reputation; seller storefront; cart; checkout (address book → quote with shipping/tax → payment method → pay); order list / detail / tracking / confirm-delivery / cancel; wishlist; dispute creation \+ threaded view with evidence upload; refund request \+ tracking; review submission \+ display; notifications feed \+ preferences; profile & addresses; invoice download; auth screens (register, login, OTP, MFA enrol/verify, password reset).

**Seller panel:** dashboard KPIs (sales, pending shipments, escrow held, payouts, low stock, rating, open disputes); product CRUD with variants, images, and bulk CSV upload with row-level validation feedback; inventory management; certification management (upload, verification status, **expiry countdowns**, re-upload on rejection); order queue \+ ship-with-tracking \+ packing slip; dispute responses; payouts list \+ downloadable settlement statements; financial reports; performance analytics; review responses; onboarding/KYC submission \+ status.

**Admin panel:** platform-health dashboard; user management (search, suspend/ban, MFA reset); seller KYC queue with document viewer \+ decision form; **certification verification queue** (side-by-side document viewer, registry-lookup result, approve/reject with mandatory evidence); listing moderation; dispute resolution centre (SLA timers, thread, escrow status, release / partial / full-refund actions); refund approvals; payout approvals; ledger explorer \+ reconciliation status; review moderation; reports (GMV, revenue, take rate, platform health); audit-log search; category & required-standards configuration; certification-standards management.

**Financial dashboards (×3 stakeholders, §6.4):** seller financials, customer financials, owner financials/BI — each with date-range selection, currency normalisation, and CSV/PDF export, strictly scoped to the authenticated party.

## Phase F2 — Contract, auth & state correctness

1. Replace any ad-hoc data fetching with the generated client \+ TanStack Query; delete duplicated hand-written types.  
2. Verify the auth flow matches spec §5.1: short-lived access token in memory, refresh via httpOnly secure cookie, silent refresh, clean logout/revoke; session-expiry UX that preserves unsaved form input.  
3. RBAC-aware navigation per role, **plus** graceful server-403 handling on every restricted screen (per ground rule 2).  
4. Error handling: map the §11.4 envelope — branch on machine `code`, show the localized message, surface `request_id` in error toasts/details for support.  
5. Client sends `Idempotency-Key` on order placement; double-click on "Pay"/"Place order" is guarded in the UI as well.  
6. Forms validated with Zod schemas mirrored from the API DTOs; field-level errors from `details[]` render inline.

## Phase F3 — Build out what's missing

Complete every screen in the F1 matrix to the standard *wired \+ three states \+ responsive \+ i18n*, in this priority order:

1. **Customer purchase path** (search → PDP → cart → checkout → orders) — revenue-critical.  
2. **Seller fulfilment \+ certification management** — supply-side critical.  
3. **Admin queues** (KYC, certification verification, dispute resolution) — the trust machinery.  
4. **Financial dashboards** (seller → owner → customer).

Apply the shared design-token package consistently; tables use cursor pagination from the API; empty states carry guidance ("No products yet — upload your first certification to start listing"), not blank panels. If the token package itself is missing, create a minimal one (colors, type scale, spacing, radii) and record that as a resolved gap.

## Phase F4 — Quality gates & proof

1. **Component tests** (Vitest \+ React Testing Library) for the high-risk units: money formatting from minor units across currencies; certification badge/panel rendering incl. expired/expiring states; facet filters building correct query params; cart/checkout summary display; dispute thread.  
2. **Per-panel render smoke** (Playwright, against the seeded test deployment): every screen in the F1 matrix loads with seed data and produces **zero console errors or warnings**. This suite is what gets merged into the main task's Phase 5\.  
3. **Accessibility:** axe checks on the critical paths (search, PDP, checkout, dispute creation, admin certification queue) — zero serious/critical violations; keyboard-operable checkout and admin decision forms; focus management on dialogs (Radix used correctly).  
4. **Performance** against the deployed test host: Lighthouse on home, category, PDP, search — record scores and meet budgets of LCP \< 2.5 s, CLS \< 0.1, desktop performance ≥ 85; `next/image` everywhere; confirm ISR is actually serving category/PDP per §9.2; produce a bundle report and flag any route chunk that is an outlier.  
5. **`SCREENS.md`:** a screenshot gallery of every matrix screen rendered with seed data, grouped by panel — this is how a human reviews completeness in minutes instead of clicking through four roles.

---

## Acceptance criteria — definition of done

- F1 matrix at 100%: every screen *exists \+ wired \+ three states \+ responsive \+ i18n*; zero open `BLOCKER`/`MAJOR` in `FRONTEND_GAP_REPORT.md` (resolutions recorded).  
- Zero console errors/warnings across the entire matrix under seed data.  
- No serious/critical axe violations on the critical paths.  
- Lighthouse budgets met and recorded against the deployed test environment.  
- i18n lint rule active in CI; `ru` \+ `en` complete, `uz` scaffolded.  
- `SCREENS.md` complete; per-panel render smoke merged into the main task's Phase-5 suite; main task DoD patched as described above.

## Out of scope

Brand/visual design beyond the token system; marketing pages and SEO content work; the iOS/Android apps (separate task); anything requiring real third-party credentials.

## Deliverables checklist

- [ ] `FRONTEND_GAP_REPORT.md` (matrix \+ resolutions)  
- [ ] All matrix screens built to standard, in the stated priority order  
- [ ] Component tests \+ per-panel Playwright smoke \+ axe checks green  
- [ ] Lighthouse report \+ bundle report committed under `/docs/frontend/`  
- [ ] `SCREENS.md` gallery  
- [ ] Main task DoD patched; Phase-5 suite extended

