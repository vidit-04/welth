import { db } from "@/lib/prisma";

/**
 * Recomputes an account's balance from its initialBalance + all transactions.
 * Call this inside any db.$transaction() that creates, updates, or deletes
 * transactions — pass the `tx` client so it reads the in-flight writes.
 *
 * This replaces manual increment/decrement arithmetic scattered across actions
 * and guarantees the stored balance never drifts from reality.
 */
export async function recalculateAccountBalance(accountId, prisma = db) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { initialBalance: true },
  });

  if (!account) return null;

  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({
      where: { accountId, type: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId, type: "EXPENSE" },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = income._sum.amount?.toNumber() ?? 0;
  const totalExpense = expense._sum.amount?.toNumber() ?? 0;
  const correctBalance =
    account.initialBalance.toNumber() + totalIncome - totalExpense;

  await prisma.account.update({
    where: { id: accountId },
    data: { balance: correctBalance },
  });

  return correctBalance;
}
