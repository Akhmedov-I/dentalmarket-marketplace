/**
 * Test helper: Clears all test data from append-only tables using TRUNCATE.
 * TRUNCATE bypasses row-level triggers (including our deny_mutation trigger),
 * which is the correct behavior for test cleanup — we WANT to prevent app-level
 * UPDATE/DELETE but we DO need to reset test state between runs.
 * 
 * This function also clears related mutable tables in the correct FK order.
 */
export async function clearAllOrders(prisma: any): Promise<void> {
  // Use raw SQL TRUNCATE to bypass append-only triggers on ledger_entries and audit_logs
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      dispute_messages,
      disputes,
      reviews,
      payouts,
      refunds,
      escrow_holds,
      ledger_entries,
      shipments,
      order_items,
      payments,
      orders,
      cart_items,
      certification_verifications,
      audit_logs
    CASCADE
  `);
}

/**
 * Clears only financial tables (ledger, escrow, payouts, refunds).
 */
export async function clearFinancialData(prisma: any): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      payouts,
      refunds,
      escrow_holds,
      ledger_entries
    CASCADE
  `);
}
