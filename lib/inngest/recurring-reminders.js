import { inngest } from "./client";
import { db } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email/send-reminder-email";

/**
 * Reminder schedule per interval.
 * reminderForDate is always nextRecurringDate (the actual due date),
 * so the unique log key becomes (transactionId, reminderType, dueDate).
 */
const REMINDER_SCHEDULE = {
  MONTHLY: [
    { reminderType: "7-days", daysAhead: 7 },
    { reminderType: "3-days", daysAhead: 3 },
    { reminderType: "1-day",  daysAhead: 1 },
  ],
  YEARLY: [
    { reminderType: "30-days", daysAhead: 30 },
    { reminderType: "15-days", daysAhead: 15 },
    { reminderType: "1-day",   daysAhead: 1  },
  ],
};

/** Days from today (UTC midnight) to target date (UTC midnight). Negative = past. */
function daysUntil(date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Daily cron (8 AM UTC) — sends reminder emails for MONTHLY and YEARLY recurring
 * transactions that have reminderEnabled=true.
 *
 * Reminder schedule:
 *   MONTHLY → 7 days before · 3 days before · 1 day before
 *   YEARLY  → 30 days before · 15 days before · 1 day before
 *
 * Idempotency: RecurringReminderLog has a unique constraint on
 * (recurringTransactionId, reminderType, reminderForDate), so re-running the cron
 * on the same day is a no-op.
 */
export const sendRecurringReminders = inngest.createFunction(
  {
    id: "send-recurring-reminders",
    name: "Send Recurring Transaction Reminders",
    triggers: [{ cron: "0 8 * * *" }],
  },
  async ({ step }) => {
    const transactions = await step.run("fetch-reminder-transactions", async () => {
      return await db.transaction.findMany({
        where: {
          isRecurring: true,
          reminderEnabled: true,
          status: "COMPLETED",
          recurringInterval: { in: ["MONTHLY", "YEARLY"] },
          nextRecurringDate: { not: null },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });
    });

    let remindersSent = 0;

    for (const transaction of transactions) {
      await step.run(`reminders-${transaction.id}`, async () => {
        const schedule = REMINDER_SCHEDULE[transaction.recurringInterval] ?? [];

        for (const { reminderType, daysAhead } of schedule) {
          if (daysUntil(transaction.nextRecurringDate) !== daysAhead) continue;

          const reminderForDate = new Date(transaction.nextRecurringDate);
          reminderForDate.setUTCHours(0, 0, 0, 0);

          // Idempotency: skip if already sent for this due date
          const existing = await db.recurringReminderLog.findUnique({
            where: {
              recurringTransactionId_reminderType_reminderForDate: {
                recurringTransactionId: transaction.id,
                reminderType,
                reminderForDate,
              },
            },
          });
          if (existing) continue;

          const result = await sendReminderEmail({
            to: transaction.user.email,
            userName: transaction.user.name ?? "there",
            transaction: {
              description: transaction.description ?? "Payment",
              amount: transaction.amount.toNumber(),
              type: transaction.type,
              recurringInterval: transaction.recurringInterval,
            },
            reminderType,
            dueDate: reminderForDate,
          });

          if (result.success) {
            await db.recurringReminderLog.create({
              data: {
                recurringTransactionId: transaction.id,
                reminderType,
                reminderForDate,
              },
            });
            remindersSent++;
          }
        }
      });
    }

    return { processed: transactions.length, remindersSent };
  }
);
