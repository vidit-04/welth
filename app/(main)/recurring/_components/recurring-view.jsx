"use client";

import { useState } from "react";
import { LayoutList, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecurringList } from "./recurring-list";
import { RecurringCalendar } from "./recurring-calendar";

export function RecurringView({ transactions }) {
  const [view, setView] = useState("list");

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setView("list")}
        >
          <LayoutList className="h-4 w-4" />
          List
        </Button>
        <Button
          variant={view === "calendar" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setView("calendar")}
        >
          <CalendarDays className="h-4 w-4" />
          Calendar
        </Button>
      </div>

      {view === "list" ? (
        <RecurringList initialTransactions={transactions} />
      ) : (
        <RecurringCalendar transactions={transactions} />
      )}
    </div>
  );
}
