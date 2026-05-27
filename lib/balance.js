import { db } from "@/lib/prisma";

/**
 * Recalculates balanceAfter for every transaction on or after `fromDate`
 * for the given account, then syncs account.balance to the final value.
 *
 * Sort rule: calendar day (UTC) ASC, then createdAt ASC within the day.
 * This matches the display order and handles legacy rows that have
 * non-midnight time components (e.g. 04:30 UTC from the old new Date() default).
 *
 * @param {string}  accountId
 * @param {Date}    fromDate   - earliest date affected; everything on this day
 *                              and later is recalculated
 * @param {object}  prisma     - db or Prisma interactive-transaction client
 */
export async function recalculateBalancesFromDate(accountId, fromDate, prisma = db) {
  const fromDay = calendarDayUTC(fromDate);
  console.log(`[balance] recalc start — account=${accountId} fromDay=${new Date(fromDay).toISOString().slice(0, 10)}`);

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { initialBalance: true },
  });

  const transactions = await prisma.transaction.findMany({
    where: { accountId },
    select: { id: true, type: true, amount: true, date: true, createdAt: true },
  });

  console.log(`[balance] fetched ${transactions.length} transactions`);

  // Sort by calendar day ASC, then createdAt ASC within the day.
  // calendarDayUTC strips the time component so a row stored as
  // 2026-05-17T04:30Z and one stored as 2026-05-17T00:00Z land in the
  // same day bucket and are ordered solely by createdAt.
  transactions.sort((a, b) => {
    const dayDiff = calendarDayUTC(a.date) - calendarDayUTC(b.date);
    return dayDiff !== 0 ? dayDiff : new Date(a.createdAt) - new Date(b.createdAt);
  });

  let runningBalance = toNum(account.initialBalance);
  let updatedCount = 0;

  for (const t of transactions) {
    const amount = toNum(t.amount);
    runningBalance =
      t.type === "INCOME" ? runningBalance + amount : runningBalance - amount;

    // Only write back rows that fall on or after the affected date.
    // Rows before fromDay still advance the running balance (so it starts
    // from the correct baseline) but their stored balanceAfter is untouched.
    if (calendarDayUTC(t.date) >= fromDay) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { balanceAfter: runningBalance },
      });
      updatedCount++;
    }
  }

  // Sync account.balance to the balance after the very last transaction.
  await prisma.account.update({
    where: { id: accountId },
    data: { balance: runningBalance },
  });

  console.log(`[balance] recalc done — updated ${updatedCount} rows, final balance=${runningBalance.toFixed(2)}`);
}

/**
 * Returns a UTC timestamp representing the calendar day that `d` belongs to.
 *
 * Shifts by +12 h before extracting the UTC date so that local-midnight dates
 * from UTC+ timezones (e.g. IST midnight stored as 2026-05-16T18:30Z, which
 * is UTC day 16) land in the correct bucket (UTC day 17 after +12 h = 06:30Z).
 * UTC midnight and mid-day timestamps are unaffected.
 */
const calendarDayUTC = (d) => {
  const shifted = new Date(new Date(d).getTime() + 12 * 60 * 60 * 1000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

const toNum = (v) =>
  typeof v?.toNumber === "function" ? v.toNumber() : Number(v);
