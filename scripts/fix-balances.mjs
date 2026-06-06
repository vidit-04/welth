/**
 * One-shot repair: recalculates every account's running balances from scratch.
 * Run once after deploying the JS-based balance recalculation fix, then delete.
 *
 *   node scripts/fix-balances.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const calendarDayUTC = (d) => {
  const dt = new Date(d);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
};
const toNum = (v) =>
  typeof v?.toNumber === "function" ? v.toNumber() : Number(v);

async function recalculate(accountId) {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { initialBalance: true },
  });

  const txns = await db.transaction.findMany({
    where: { accountId },
    select: { id: true, type: true, amount: true, date: true, createdAt: true },
  });

  txns.sort((a, b) => {
    const diff = calendarDayUTC(a.date) - calendarDayUTC(b.date);
    return diff !== 0 ? diff : new Date(a.createdAt) - new Date(b.createdAt);
  });

  let running = toNum(account.initialBalance);

  for (const t of txns) {
    const amt = toNum(t.amount);
    running = t.type === "INCOME" ? running + amt : running - amt;
    await db.transaction.update({
      where: { id: t.id },
      data: { balanceAfter: running },
    });
  }

  await db.account.update({ where: { id: accountId }, data: { balance: running } });
  return { count: txns.length, finalBalance: running };
}

async function main() {
  const accounts = await db.account.findMany({ select: { id: true, name: true } });
  console.log(`Recalculating ${accounts.length} account(s)…\n`);

  for (const acc of accounts) {
    const { count, finalBalance } = await recalculate(acc.id);
    console.log(`  ✓  ${acc.name.padEnd(30)} ${count} txns  →  balance ₹${finalBalance.toFixed(2)}`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
