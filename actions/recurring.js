"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const serialize = (obj) => {
  const out = { ...obj };
  if (out.amount != null) out.amount = out.amount?.toNumber?.() ?? out.amount;
  if (out.balanceAfter != null) out.balanceAfter = out.balanceAfter?.toNumber?.() ?? out.balanceAfter;
  return out;
};

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":   next.setDate(next.getDate() + 1); break;
    case "WEEKLY":  next.setDate(next.getDate() + 7); break;
    case "MONTHLY": next.setMonth(next.getMonth() + 1); break;
    case "YEARLY":  next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");
  return user;
}

export async function getRecurringTransactions() {
  const user = await getAuthUser();

  const transactions = await db.transaction.findMany({
    where: { userId: user.id, isRecurring: true },
    include: { account: { select: { id: true, name: true } } },
    orderBy: { nextRecurringDate: "asc" },
  });

  return transactions.map(serialize);
}

export async function toggleRecurringReminder(transactionId, enabled) {
  const user = await getAuthUser();

  await db.transaction.update({
    where: { id: transactionId, userId: user.id },
    data: { reminderEnabled: enabled },
  });

  revalidatePath("/recurring");
  return { success: true };
}

export async function skipNextOccurrence(transactionId) {
  const user = await getAuthUser();

  const transaction = await db.transaction.findUnique({
    where: { id: transactionId, userId: user.id },
  });

  if (!transaction?.nextRecurringDate || !transaction.recurringInterval) {
    throw new Error("Transaction not found or not recurring");
  }

  const skippedDate = new Date(transaction.nextRecurringDate);
  const newNextDate = calculateNextRecurringDate(skippedDate, transaction.recurringInterval);

  const updated = await db.transaction.update({
    where: { id: transactionId, userId: user.id },
    data: { nextRecurringDate: newNextDate },
    include: { account: { select: { id: true, name: true } } },
  });

  revalidatePath("/recurring");
  return { success: true, data: serialize(updated) };
}

export async function updateRecurringTransaction(transactionId, { amount, nextRecurringDate, recurringInterval }) {
  const user = await getAuthUser();

  const updated = await db.transaction.update({
    where: { id: transactionId, userId: user.id },
    data: {
      ...(amount        != null && { amount: parseFloat(amount) }),
      ...(nextRecurringDate != null && { nextRecurringDate: new Date(nextRecurringDate) }),
      ...(recurringInterval != null && { recurringInterval }),
    },
    include: { account: { select: { id: true, name: true } } },
  });

  revalidatePath("/recurring");
  return { success: true, data: serialize(updated) };
}

export async function cancelRecurringTransaction(transactionId) {
  const user = await getAuthUser();

  await db.transaction.update({
    where: { id: transactionId, userId: user.id },
    data: { isRecurring: false, nextRecurringDate: null, reminderEnabled: false },
  });

  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  return { success: true };
}
