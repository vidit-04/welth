"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { recalculateBalancesFromDate } from "@/lib/balance";

const serializeDecimal = (obj) => {
  const serialized = { ...obj };
  if (obj.balance != null) serialized.balance = obj.balance?.toNumber?.() ?? obj.balance;
  if (obj.initialBalance != null) serialized.initialBalance = obj.initialBalance?.toNumber?.() ?? obj.initialBalance;
  if (obj.amount != null) serialized.amount = obj.amount?.toNumber?.() ?? obj.amount;
  if (obj.balanceAfter != null) serialized.balanceAfter = obj.balanceAfter?.toNumber?.() ?? obj.balanceAfter;
  return serialized;
};

export async function getAccountWithTransactions(accountId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const account = await db.account.findUnique({
    where: {
      id: accountId,
      userId: user.id,
    },
    include: {
      transactions: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
      _count: {
        select: { transactions: true },
      },
    },
  });

  if (!account) return null;

  return {
    ...serializeDecimal(account),
    transactions: account.transactions.map(serializeDecimal),
  };
}

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get transactions to calculate balance changes
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });

    console.log("Found transactions to delete:", transactions.length);

    // Group by account, find earliest affected date per account
    const accountFromDates = transactions.reduce((acc, t) => {
      const d = new Date(t.date);
      if (!acc[t.accountId] || d < acc[t.accountId]) acc[t.accountId] = d;
      return acc;
    }, {});

    // Delete then recalculate only from the earliest affected date forward
    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { id: { in: transactionIds }, userId: user.id },
      });

      for (const [accountId, fromDate] of Object.entries(accountFromDates)) {
        await recalculateBalancesFromDate(accountId, fromDate, tx);
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

    return { success: true };
  } catch (error) {
    console.error("Bulk delete error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // First, unset any existing default account
    await db.account.updateMany({
      where: {
        userId: user.id,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Then set the new default account
    const account = await db.account.update({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: { isDefault: true },
    });

    revalidatePath("/dashboard");
    return { success: true, data: serializeDecimal(account) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
