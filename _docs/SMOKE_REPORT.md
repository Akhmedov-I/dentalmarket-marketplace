# SMOKE_REPORT.md — Playwright E2E Smoke Test Results

**Audited Suite:** `web/e2e/smoke.spec.ts`  
**Execution Environment:** Localhost Test Stack (Docker Compose + NestJS Backend + Next.js Frontend)  
**Date:** 2026-06-10  
**Overall Status:** ✅ **ALL GREEN (5/5 PASSED)**  
**Total Runtime:** 7.0 seconds  

---

## Pass/Fail Status & Timings

| Step | Test Name | Status | Timing | Key Assertions & Actions |
|------|-----------|--------|--------|--------------------------|
| **1** | Admin logs in successfully and approves Seller KYC | ✅ PASS | 982ms | Logs in as `admin-smoke@dentalmarket.uz`, redirects to `/admin` dashboard, updates `SellerProfile` status to `approved`. |
| **2** | Seller uploads certification, compliance verifies it, product is published and appears in search | ✅ PASS | 2.6s | Creates draft product, adds certificate, updates status to `verified` and `active`, indexes in OpenSearch, validates search page visibility. |
| **3** | Buyer registers, searches, adds to cart, and finishes mock checkouts | ✅ PASS | 3.0s | Registers `buyer-smoke@dentalmarket.uz`, logs in automatically, checks `BU` avatar initials, adds product to cart, validates cart badge count. |
| **4** | Simulation of payment webhooks, shipments, and escrow release checks | ✅ PASS | 161ms | Creates billing/shipping addresses, orders, order items, simulates Stripe mock webhook, holds escrow, releasing and distributing funds. |
| **5** | Dispute resolutions, negative validations, and ledger balance checking | ✅ PASS | 138ms | Performs negative checks (blocks double-releasing), audits platform ledger trial balance sum to guarantee zero-sum transactions. |

---

## Trial Balance Audit Report

The B2B DentalMarket transaction ledger ledger balances must net to exactly zero across all debit and credit entries to ensure double-entry accounting integrity.

At the end of the E2E smoke run, a database-level query was executed across all `ledger_entries` created during the test run.

### Ledger Trial Balance Calculation:
- **Total Debits**: `+85,000,000 UZS` (escrow hold) + `+85,000,000 UZS` (escrow release debit) = `+170,000,000 UZS`
- **Total Credits**: `-85,000,000 UZS` (buyer escrow hold credit) - `4,250,000 UZS` (platform commission) - `80,750,000 UZS` (seller payout) = `-170,000,000 UZS`
- **Net Sum**: `0 UZS`

> [!NOTE]
> **Trial Balance Netting: 0 UZS** (Perfect match).
> No discrepancy found. Double-entry accounting system integrity is verified.

---

## Artifact Links

- **E2E Test Script**: [smoke.spec.ts](file:///c:/Users/PcShop/OneDrive/Desktop/startUPS/for_zygoma/online_store/web/e2e/smoke.spec.ts)
- **Web Frontend Audit Report**: [FRONTEND_GAP_REPORT.md](file:///c:/Users/PcShop/OneDrive/Desktop/startUPS/for_zygoma/online_store/_docs/FRONTEND_GAP_REPORT.md)
- **Overall Gap Report**: [GAP_REPORT.md](file:///c:/Users/PcShop/OneDrive/Desktop/startUPS/for_zygoma/online_store/_docs/GAP_REPORT.md)
- **Deferred Backlog**: [BACKLOG.md](file:///c:/Users/PcShop/OneDrive/Desktop/startUPS/for_zygoma/online_store/_docs/BACKLOG.md)
