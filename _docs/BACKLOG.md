# BACKLOG.md — Deferred Items

Items classified as MINOR in `GAP_REPORT.md`, deferred with rationale.

| # | Item | Rationale for Deferral |
|---|------|------------------------|
| 23 | CHECK constraints on monetary columns (non-negative) | App-level validation already enforces this; DB constraint is defense-in-depth, not blocking functionality |
| 24 | Rate limiting middleware | Not required for test environment; will be added before production |
| 25 | Cursor-based pagination standardization | Existing pagination works; standardization is a polish item |
| 26 | 100% line coverage on payment/escrow/ledger | Current coverage is good (32 passing tests); will improve incrementally |
| 27 | README.md | Will be created as README-TEST.md in Phase 4 |

---

## Future Enhancements (not in spec scope)

- GraphQL BFF for mobile (spec §5 Phase 4)
- Kafka migration from RabbitMQ (spec §3.1 Phase 4)  
- Advanced analytics with ClickHouse CDC pipeline
- Real PSP sandbox integration (Payme, Click)
- TestFlight / Play internal track distribution
- Production Terraform IaC
