"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { generateRecurringOccurrences } from "@/lib/calendar/recurring-engine";

function toISOOrNull(v) {
  if (v == null) return v;
  return v instanceof Date ? v.toISOString() : v;
}

function serializeTx(tx) {
  const out = { ...tx };
  if (out.amount != null) out.amount = out.amount?.toNumber?.() ?? out.amount;
  if (out.balanceAfter != null)
    out.balanceAfter = out.balanceAfter?.toNumber?.() ?? out.balanceAfter;
  out.date = toISOOrNull(out.date);
  out.createdAt = toISOOrNull(out.createdAt);
  out.updatedAt = toISOOrNull(out.updatedAt);
  out.nextRecurringDate = toISOOrNull(out.nextRecurringDate);
  out.lastProcessed = toISOOrNull(out.lastProcessed);
  if (out.account) {
    out.account = { ...out.account };
    if (out.account.balance != null)
      out.account.balance = out.account.balance?.toNumber?.() ?? out.account.balance;
    if (out.account.initialBalance != null)
      out.account.initialBalance =
        out.account.initialBalance?.toNumber?.() ?? out.account.initialBalance;
  }
  return out;
}

export async function getCalendarData({ accountId, year, month }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);

  const startDate = new Date(Date.UTC(y, m - 1, 1));
  const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const today = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  );

  const accountFilter =
    accountId && accountId !== "all" ? { accountId } : {};

  const [transactions, recurringTemplates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
        ...accountFilter,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { account: { select: { id: true, name: true } } },
    }),
    db.transaction.findMany({
      where: {
        userId: user.id,
        isRecurring: true,
        nextRecurringDate: { lte: endDate },
        ...accountFilter,
      },
      include: { account: { select: { id: true, name: true } } },
    }),
  ]);

  const projections = [];
  for (const template of recurringTemplates) {
    const occurrences = generateRecurringOccurrences(template, startDate, endDate);
    for (const occDate of occurrences) {
      const dateStr = occDate.toISOString().slice(0, 10);
      const rawAmount = template.amount?.toNumber?.() ?? template.amount;
      projections.push({
        id: `proj_${template.id}_${dateStr}`,
        type: template.type,
        amount: rawAmount,
        description: template.description,
        date: occDate.toISOString(),
        category: template.category,
        isRecurring: true,
        recurringInterval: template.recurringInterval,
        isProjection: true,
        sourceTransactionId: template.id,
        accountId: template.accountId,
        account: template.account,
        isFuture: occDate >= today,
      });
    }
  }

  const serialized = transactions.map(serializeTx);

  const totalIncome = serialized
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = serialized
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);

  const upcomingProjections = projections.filter((p) => p.isFuture);
  const upcomingRecurringAmount = upcomingProjections
    .filter((p) => p.type === "EXPENSE")
    .reduce((s, p) => s + p.amount, 0);

  return {
    transactions: serialized,
    projections,
    summary: {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      upcomingRecurringCount: upcomingProjections.length,
      upcomingRecurringAmount,
    },
  };
}
