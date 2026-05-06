import { db } from "@/lib/prisma";

/**
 * Recalculates balanceAfter for every transaction on or after `fromDate`
 * for the given account, then syncs account.balance to the latest value.
 *
 * Uses two SQL statements regardless of how many rows are affected:
 *   1. Window-function UPDATE — computes running balance in one pass
 *   2. Single UPDATE — sets account.balance to the most recent balanceAfter
 *
 * Call this inside a Prisma interactive transaction (pass `tx` as `prisma`)
 * so all writes are atomic with the triggering mutation.
 *
 * @param {string}  accountId
 * @param {Date}    fromDate   - earliest date affected; all later transactions recalculate too
 * @param {object}  prisma     - db client or transaction client
 */
export async function recalculateBalancesFromDate(accountId, fromDate, prisma = db) {
  // Step 1: recalculate balanceAfter for all transactions >= fromDate.
  // balance_before = initialBalance + net of all transactions strictly before fromDate.
  // Then a window SUM walks chronologically through the affected rows.
  await prisma.$executeRaw`
    WITH balance_before AS (
      SELECT
        a."initialBalance"
        + COALESCE(
            SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END),
            0
          ) AS val
      FROM accounts a
      LEFT JOIN transactions t
        ON  t."accountId" = a.id
        AND t.date < ${fromDate}
      WHERE a.id = ${accountId}
      GROUP BY a."initialBalance"
    ),
    ordered AS (
      SELECT
        id, type, amount,
        ROW_NUMBER() OVER (ORDER BY date ASC, "createdAt" ASC) AS rn
      FROM transactions
      WHERE "accountId" = ${accountId}
        AND date >= ${fromDate}
    ),
    cumulative AS (
      SELECT
        o.id,
        (SELECT val FROM balance_before)
          + SUM(CASE WHEN o.type = 'INCOME' THEN o.amount ELSE -o.amount END)
              OVER (ORDER BY o.rn) AS balance_after
      FROM ordered o
    )
    UPDATE transactions t
    SET "balanceAfter" = c.balance_after
    FROM cumulative c
    WHERE t.id = c.id
  `;

  // Step 2: sync account.balance to the most recent transaction's balanceAfter.
  // Falls back to initialBalance if the account has no transactions at all.
  await prisma.$executeRaw`
    UPDATE accounts
    SET balance = COALESCE(
      (
        SELECT "balanceAfter"
        FROM transactions
        WHERE "accountId" = ${accountId}
          AND "balanceAfter" IS NOT NULL
        ORDER BY date DESC, "createdAt" DESC
        LIMIT 1
      ),
      "initialBalance"
    )
    WHERE id = ${accountId}
  `;
}
