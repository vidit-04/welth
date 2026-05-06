import { db } from "@/lib/prisma";

/**
 * Recomputes an account's balance from initialBalance + all transactions
 * using a single SQL statement — same number of DB round-trips as the old
 * manual-increment approach, but correct by construction (no arithmetic drift).
 *
 * Safe to call inside a Prisma interactive transaction (pass the `tx` client).
 */
export async function recalculateAccountBalance(accountId, prisma = db) {
  await prisma.$executeRaw`
    UPDATE accounts
    SET balance = (
      SELECT a."initialBalance"
           + COALESCE(SUM(CASE WHEN t.type = 'INCOME'  THEN t.amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0)
        FROM accounts a
        LEFT JOIN transactions t ON t."accountId" = a.id
       WHERE a.id = ${accountId}
    )
    WHERE id = ${accountId}
  `;
}
