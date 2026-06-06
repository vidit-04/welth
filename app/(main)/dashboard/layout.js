import DashboardPage from "./page";
import { BarLoader } from "react-spinners";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout() {
  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-6xl font-bold tracking-tight gradient-title">
          Dashboard
        </h1>
        <Link href="/calendar">
          <Button variant="outline" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Button>
        </Link>
      </div>
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <DashboardPage />
      </Suspense>
    </div>
  );
}
