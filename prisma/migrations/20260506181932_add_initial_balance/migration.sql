-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "initialBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Backfill: initialBalance = currentBalance - netTransactions
-- This recovers the original opening balance for existing accounts.
-- Formula: initialBalance = balance - (SUM(INCOME) - SUM(EXPENSE))
UPDATE "accounts" a
SET "initialBalance" = a.balance - COALESCE(
  (SELECT SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END)
   FROM transactions t
   WHERE t."accountId" = a.id),
  0
);
