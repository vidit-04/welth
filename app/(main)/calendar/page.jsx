import { Suspense } from "react";
import { BarLoader } from "react-spinners";
import { getUserAccounts } from "@/actions/dashboard";
import { getCalendarData } from "@/actions/calendar";
import { FinancialCalendar } from "@/components/calendar/financial-calendar";

async function CalendarContent() {
  const now = new Date();
  const [accounts, initialData] = await Promise.all([
    getUserAccounts(),
    getCalendarData({
      accountId: "all",
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    }),
  ]);

  return <FinancialCalendar accounts={accounts} initialData={initialData} />;
}

export default function CalendarPage() {
  return (
    <div className="px-5 space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold tracking-tight gradient-title">Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your financial timeline — transactions, recurring payments, and upcoming obligations
          </p>
        </div>
      </div>

      <Suspense fallback={<BarLoader className="mt-4" width="100%" color="#9333ea" />}>
        <CalendarContent />
      </Suspense>
    </div>
  );
}
