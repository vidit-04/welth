"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INTERVAL_DOT = {
  DAILY:   "bg-orange-400",
  WEEKLY:  "bg-blue-400",
  MONTHLY: "bg-violet-400",
  YEARLY:  "bg-emerald-400",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getOccurrencesInMonth(transaction, monthStart, monthEnd) {
  if (!transaction.nextRecurringDate) return [];
  const dates = [];
  let cur = new Date(transaction.nextRecurringDate);

  const advance = (d) => {
    switch (transaction.recurringInterval) {
      case "DAILY":   return addDays(d, 1);
      case "WEEKLY":  return addWeeks(d, 1);
      case "MONTHLY": return addMonths(d, 1);
      case "YEARLY":  return addYears(d, 1);
      default: return null;
    }
  };

  // If next date is past the month, nothing to show
  if (cur > monthEnd) return [];

  // Fast-forward into the month window
  while (cur < monthStart) {
    const next = advance(cur);
    if (!next || next <= cur) return [];
    cur = next;
    if (cur > monthEnd) return [];
  }

  // Collect all occurrences within the month
  while (cur <= monthEnd) {
    dates.push(new Date(cur));
    const next = advance(cur);
    if (!next || next <= cur) break;
    cur = next;
  }

  return dates;
}

export function RecurringCalendar({ transactions }) {
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedKey, setSelectedKey] = useState(null);

  const monthStart = startOfMonth(new Date(calYear, calMonth));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const goPrev = () => {
    setSelectedKey(null);
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };

  const goNext = () => {
    setSelectedKey(null);
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const dayMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      for (const date of getOccurrencesInMonth(t, monthStart, monthEnd)) {
        const key = format(date, "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, calMonth, calYear]);

  const selectedTransactions = selectedKey ? (dayMap[selectedKey] ?? []) : [];

  const totalCells = startPad + days.length;
  const trailingPad = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold">
          {format(new Date(calYear, calMonth), "MMMM yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={goNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {[["DAILY","Daily","bg-orange-400"],["WEEKLY","Weekly","bg-blue-400"],["MONTHLY","Monthly","bg-violet-400"],["YEARLY","Yearly","bg-emerald-400"]].map(
          ([key, label, color]) =>
            transactions.some((t) => t.recurringInterval === key) && (
              <span key={key} className="flex items-center gap-1">
                <span className={cn("h-2 w-2 rounded-full", color)} />
                {label}
              </span>
            )
        )}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {/* Leading empty cells */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pre-${i}`} className="min-h-[80px] border-b border-r bg-muted/10 last:border-r-0" />
          ))}

          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTx = dayMap[key] ?? [];
            const isSelected = selectedKey === key;
            const isTodayDay = isToday(day);
            const col = (startPad + i) % 7;
            const isLastInRow = col === 6;
            const isInLastRow = startPad + i >= totalCells - 7;

            return (
              <div
                key={key}
                onClick={() => dayTx.length > 0 && setSelectedKey(isSelected ? null : key)}
                className={cn(
                  "min-h-[80px] p-1.5 transition-colors",
                  !isLastInRow && "border-r",
                  !isInLastRow && "border-b",
                  dayTx.length > 0 && "cursor-pointer hover:bg-muted/30",
                  isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                )}
              >
                {/* Day number */}
                <div className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isTodayDay ? "bg-primary text-primary-foreground" : "text-foreground"
                )}>
                  {format(day, "d")}
                </div>

                {/* Dots (mobile) */}
                <div className="flex flex-wrap gap-0.5 sm:hidden">
                  {dayTx.slice(0, 3).map((t) => (
                    <span key={t.id} className={cn("h-1.5 w-1.5 rounded-full", INTERVAL_DOT[t.recurringInterval])} />
                  ))}
                  {dayTx.length > 3 && (
                    <span className="text-[10px] leading-none text-muted-foreground">+{dayTx.length - 3}</span>
                  )}
                </div>

                {/* Labels (desktop) */}
                <div className="hidden space-y-0.5 sm:block">
                  {dayTx.slice(0, 2).map((t) => (
                    <p
                      key={t.id}
                      className={cn(
                        "truncate rounded px-1 text-[10px] leading-[1.4]",
                        t.type === "EXPENSE"
                          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                          : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                      )}
                    >
                      {t.description || "Untitled"}
                    </p>
                  ))}
                  {dayTx.length > 2 && (
                    <p className="pl-1 text-[10px] text-muted-foreground">+{dayTx.length - 2} more</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Trailing empty cells */}
          {Array.from({ length: trailingPad }).map((_, i) => (
            <div key={`post-${i}`} className={cn("min-h-[80px] bg-muted/10", i < trailingPad - 1 && "border-r")} />
          ))}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedKey && selectedTransactions.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">
            {format(new Date(selectedKey), "EEEE, MMMM d")}
          </h3>
          <div className="space-y-2">
            {selectedTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.description || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.account?.name} · {t.recurringInterval}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-0.5 text-sm font-semibold",
                    t.type === "EXPENSE" ? "text-red-500" : "text-green-500"
                  )}
                >
                  {t.type === "EXPENSE"
                    ? <ArrowDownRight className="h-3.5 w-3.5" />
                    : <ArrowUpRight className="h-3.5 w-3.5" />}
                  ₹{t.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
