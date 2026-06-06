import { getRecurringTransactions } from "@/actions/recurring";
import { RecurringList } from "./_components/recurring-list";

export const metadata = { title: "Recurring Transactions — Welth" };

export default async function RecurringPage() {
  const transactions = await getRecurringTransactions();

  const counts = transactions.reduce((acc, t) => {
    acc[t.recurringInterval] = (acc[t.recurringInterval] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-5 space-y-6 pb-8">
      <div>
        <h1 className="text-5xl font-bold tracking-tight gradient-title">
          Recurring
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {transactions.length === 0
            ? "No active recurring transactions"
            : `${transactions.length} active · ${counts.MONTHLY ?? 0} monthly · ${counts.YEARLY ?? 0} yearly`}
        </p>
      </div>

      <RecurringList initialTransactions={transactions} />
    </div>
  );
}
