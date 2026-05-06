-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "balanceAfter" DECIMAL(65,30);

-- Backfill balanceAfter for all existing transactions using a window function.
-- Partitioned by account, ordered chronologically (date ASC, createdAt ASC).
-- Running sum starts from the account's initialBalance.
UPDATE transactions t
SET "balanceAfter" = c.balance_after
FROM (
  SELECT
    t2.id,
    a."initialBalance" + SUM(
      CASE WHEN t2.type = 'INCOME' THEN t2.amount ELSE -t2.amount END
    ) OVER (
      PARTITION BY t2."accountId"
      ORDER BY t2.date ASC, t2."createdAt" ASC
      ROWS UNBOUNDED PRECEDING
    ) AS balance_after
  FROM transactions t2
  JOIN accounts a ON a.id = t2."accountId"
) c
WHERE t.id = c.id;

-- Sync account.balance to the most recent transaction's balanceAfter.
-- Accounts with no transactions keep their initialBalance.
UPDATE accounts a
SET balance = COALESCE(
  (
    SELECT t."balanceAfter"
    FROM transactions t
    WHERE t."accountId" = a.id
    ORDER BY t.date DESC, t."createdAt" DESC
    LIMIT 1
  ),
  a."initialBalance"
);
