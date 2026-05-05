"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get budget for specific account
    const budget = await db.budget.findFirst({
      where: {
        userId: user.id,
        accountId: accountId,
      },
    });

    // Get current month's expenses for the specific account.
    // startOfMonth is pulled back 6 h from UTC midnight so that transactions
    // created on the 1st in IST (UTC+5:30, stored as ~18:30 UTC prev day)
    // are still included. Safe because calendar-picked dates are always at
    // local midnight, so the prev-month's last day is ~18:30 UTC, well before
    // the 18:00 UTC boundary.
    const currentDate = new Date();
    const startOfMonth = new Date(
      Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1) -
        6 * 60 * 60 * 1000
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const expenses = await db.transaction.aggregate({
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        accountId,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      budget: budget ? { ...budget, amount: budget.amount.toNumber() } : null,
      currentExpenses: expenses._sum.amount
        ? expenses._sum.amount.toNumber()
        : 0,
    };
  } catch (error) {
    console.error("Error fetching budget:", error);
    throw error;
  }
}

export async function updateBudget(amount, accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Update or create budget for specific account
    const budget = await db.budget.upsert({
      where: {
        userId_accountId: {
          userId: user.id,
          accountId: accountId,
        },
      },
      update: {
        amount,
      },
      create: {
        userId: user.id,
        accountId: accountId,
        amount,
      },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      data: { ...budget, amount: budget.amount.toNumber() },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return { success: false, error: error.message };
  }
}
