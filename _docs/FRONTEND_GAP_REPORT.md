# FRONTEND_GAP_REPORT.md — DentalMarket Web Frontend Audit

**Audited against:** `Agent_Task_Web_Frontend_Audit_and_Completion.md` and `DentalMarket_Technical_Specification.md` v1.0
**Date:** 2026-06-10

---

## Screen Inventory & Status Matrix

| Screen / Feature | Route / File Path | Exists? | Wired to API? | Handles States? (Load/Empty/Error) | Responsive? (at 768px) | i18n Scaffold? | Severity / Status |
|------------------|-------------------|---------|---------------|-----------------------------------|------------------------|----------------|-------------------|
| **Customer Home** | `web/src/app/(customer)/page.tsx` | Yes | N/A (static content) | N/A | Yes | Yes | ✅ RESOLVED |
| **Catalog / Search** | `web/src/app/(customer)/search/page.tsx` | Yes | Yes (OpenSearch) | Yes (renders skeleton & empty state) | Yes | Yes | ✅ RESOLVED |
| **Auth - Login** | `web/src/app/(auth)/login/page.tsx` | Yes | Yes (NestJS auth/login) | Yes (error alerts, loading indicators) | Yes | Yes | ✅ RESOLVED |
| **Auth - Register** | `web/src/app/(auth)/register/page.tsx` | Yes | Yes (NestJS auth/register) | Yes (error alerts, loading indicators) | Yes | Yes | ✅ RESOLVED |
| **Seller Dashboard** | `web/src/app/(seller)/seller/page.tsx` | Yes | Yes (Prisma counts) | Yes (KPI loading/empty indicators) | Yes | Yes | ✅ RESOLVED |
| **Admin Dashboard** | `web/src/app/(admin)/admin/page.tsx` | Yes | Yes (Platform stats) | Yes (Activity loading indicators) | Yes | Yes | ✅ RESOLVED |
| **Header / Layouts** | `web/src/components/layout/header.tsx` | Yes | Yes (User session check) | Yes (Avatar fallback/initials) | Yes | Yes | ✅ RESOLVED |

---

## Resolved Blocker & Major Gaps

1. **API Connection staleTime / initialData Issue**
   - **Finding:** The TanStack Query client on the Search page had `initialData` set to `MOCK_PRODUCTS` combined with a global `staleTime` of 60s. This prevented it from querying the NestJS backend search API upon mount.
   - **Resolution:** Removed the `initialData` property from the query configuration so it immediately triggers the `/api/v1/search` API call on mount.

2. **CORS Configuration & Auth Credentials**
   - **Finding:** Cross-origin cookie and credential transmission was blocked by missing configurations on the API backend.
   - **Resolution:** Modified the NestJS CORS settings in `backend/src/main.ts` to explicitly whitelist origins `http://localhost:3001` and `http://127.0.0.1:3001` with `credentials: true`.

3. **Register Request Payload Schema**
   - **Finding:** Frontend registration was sending `roles: [role]`, but `RegisterDto` on the backend expects a single `role` enum field.
   - **Resolution:** Remapped registration fields to submit a single `role` key matching `RegisterRole`.

---

## Future Polish (Deferred Gaps in BACKLOG)

- **Standardized i18n Translation Files**: Scaffolded translations inside components; need unified JSON translations under `next-intl` configuration.
- **Accessibility Axe Audit**: Fully keyboard operable; needs automated CI axe validations.
