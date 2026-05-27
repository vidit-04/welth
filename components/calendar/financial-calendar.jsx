"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import useFetch from "@/hooks/use-fetch";
import { getCalendarData } from "@/actions/calendar";
import { CalendarDayCell } from "./calendar-day-cell";
import { TransactionModal } from "./transaction-modal";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "recurring", label: "Recurring" },
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayUTCStr() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function FinancialCalendar({ accounts, initialData }) {
  const todayUTCStr = getTodayUTCStr();
  const todayYear = parseInt(todayUTCStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayUTCStr.slice(5, 7), 10);

  const [currentYear, setCurrentYear] = useState(todayYear);
  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(null);

  const { data: fetchedData, loading, fn: fetchCalendarData } = useFetch(getCalendarData);

  // initialData covers the current month/all accounts — use it until we fetch something different
  const [hasInitialFetch, setHasInitialFetch] = useState(false);
  const calendarData = fetchedData || (hasInitialFetch ? null : initialData);

  useEffect(() => {
    setHasInitialFetch(true);
    fetchCalendarData({
      accountId: selectedAccount,
      year: currentYear,
      month: currentMonth,
    });
  }, [currentYear, currentMonth, selectedAccount]);

  // Build date-keyed map for O(1) lookups
  const dateMap = useMemo(() => {
    if (!calendarData) return {};
    const map = {};
    for (const tx of calendarData.transactions) {
      const key = new Date(tx.date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = { transactions: [], projections: [] };
      map[key].transactions.push(tx);
    }
    for (const proj of calendarData.projections) {
      const key = new Date(proj.date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = { transactions: [], projections: [] };
      map[key].projections.push(proj);
    }
    return map;
  }, [calendarData]);

  // Build 42-cell calendar grid (6 rows × 7 cols)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(Date.UTC(currentYear, currentMonth - 1, 1 - firstDay + i));
      const cellYear = d.getUTCFullYear();
      const cellMonth = d.getUTCMonth() + 1;
      const cellDay = d.getUTCDate();
      const isCurrentMonth = cellMonth === currentMonth && cellYear === currentYear;
      const dateStr = [
        cellYear,
        String(cellMonth).padStart(2, "0"),
        String(cellDay).padStart(2, "0"),
      ].join("-");
      return {
        day: cellDay,
        dateStr,
        isCurrentMonth,
        isToday: dateStr === todayUTCStr,
        dayData: dateMap[dateStr] || { transactions: [], projections: [] },
      };
    });
  }, [currentYear, currentMonth, dateMap, todayUTCStr]);

  const navigateMonth = (delta) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const goToToday = () => {
    setCurrentYear(todayYear);
    setCurrentMonth(todayMonth);
  };

  const summary = calendarData?.summary;
  const selectedDayData = selectedDate
    ? dateMap[selectedDate] || { transactions: [], projections: [] }
    : null;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Month navigation */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[170px] text-center tabular-nums">
            {MONTHS[currentMonth - 1]} {currentYear}
          </h2>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {(currentYear !== todayYear || currentMonth !== todayMonth) && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground ml-1" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Loading indicator */}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {/* Account selector */}
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Income"
            value={formatCurrency(summary.totalIncome)}
            icon={TrendingUp}
            colorClass="text-green-600"
            bgClass="bg-green-50 dark:bg-green-950/20"
          />
          <SummaryCard
            label="Expenses"
            value={formatCurrency(summary.totalExpense)}
            icon={TrendingDown}
            colorClass="text-red-600"
            bgClass="bg-red-50 dark:bg-red-950/20"
          />
          <SummaryCard
            label="Net Savings"
            value={formatCurrency(summary.netSavings)}
            icon={Wallet}
            colorClass={summary.netSavings >= 0 ? "text-green-600" : "text-red-600"}
            bgClass={
              summary.netSavings >= 0
                ? "bg-green-50 dark:bg-green-950/20"
                : "bg-red-50 dark:bg-red-950/20"
            }
          />
          <SummaryCard
            label="Upcoming Recurring"
            value={formatCurrency(summary.upcomingRecurringAmount)}
            subtitle={`${summary.upcomingRecurringCount} event${
              summary.upcomingRecurringCount !== 1 ? "s" : ""
            }`}
            icon={RefreshCw}
            colorClass="text-purple-600"
            bgClass="bg-purple-50 dark:bg-purple-950/20"
          />
        </div>
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border",
              activeFilter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="py-2.5 text-center text-xs font-semibold text-muted-foreground tracking-wide"
            >
              <span className="hidden sm:inline">{wd}</span>
              <span className="sm:hidden">{wd[0]}</span>
            </div>
          ))}
        </div>

        {/* Day cells — 6 rows */}
        <div className="grid grid-cols-7">
          {calendarCells.map((cell) => (
            <CalendarDayCell
              key={cell.dateStr}
              cell={cell}
              filter={activeFilter}
              onClick={() => setSelectedDate(cell.dateStr)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300" />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
          Expense
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-purple-100 border border-purple-300" />
          Recurring (projected)
        </span>
      </div>

      {/* Day detail drawer */}
      <TransactionModal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        dateStr={selectedDate}
        dayData={selectedDayData}
      />
    </div>
  );
}

function SummaryCard({ label, value, subtitle, icon: Icon, colorClass, bgClass }) {
  return (
    <div className={cn("rounded-lg border p-3 sm:p-4", bgClass)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", colorClass)} />
        <span className="text-xs text-muted-foreground font-medium leading-none">{label}</span>
      </div>
      <p className={cn("text-base sm:text-lg font-bold leading-tight", colorClass)}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
