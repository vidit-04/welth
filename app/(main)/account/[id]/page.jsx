import { Suspense } from "react";
import { getAccountWithTransactions } from "@/actions/account";
import { getCurrentBudget } from "@/actions/budget";
import { BarLoader } from "react-spinners";
import { TransactionTable } from "../_components/transaction-table";
import { BudgetProgress } from "../../dashboard/_components/budget-progress";
import { notFound } from "next/navigation";
import { AccountChart } from "../_components/account-chart";

export default async function AccountPage({ params }) {
  const resolvedParams = await params;
  const accountData = await getAccountWithTransactions(resolvedParams.id);

  if (!accountData) {
    notFound();
  }

  const { transactions, ...account } = accountData;

  // Get budget for this account
  const budgetData = await getCurrentBudget(account.id);

  return (
    <div className="space-y-6 px-3 pb-6 sm:space-y-8 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight gradient-title capitalize break-words leading-tight">
            {account.name}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {account.type.charAt(0) + account.type.slice(1).toLowerCase()}{" "}
            Account
          </p>
        </div>
        <div className="text-left sm:text-right sm:pb-2">
          <div className="text-lg sm:text-2xl font-bold">
            ₹{parseFloat(account.balance).toFixed(2)}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {account._count.transactions} Transactions
          </p>
        </div>
      </div>

      {/* Budget Progress */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
        accountId={account.id}
        accountName={account.name}
      />

      {/* Chart Section */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <AccountChart transactions={transactions} />
      </Suspense>

      {/* Transactions Table */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <TransactionTable transactions={transactions} />
      </Suspense>
    </div>
  );
}
