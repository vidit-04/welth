"use client";

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { defaultCategories } from "@/data/categories";

const categoryMap = Object.fromEntries(defaultCategories.map((c) => [c.id, c]));

function formatCompact(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
  return `₹${Math.round(amount)}`;
}

function applyFilter(transactions, projections, filter) {
  switch (filter) {
    case "income":
      return { txs: transactions.filter((t) => t.type === "INCOME"), projs: [] };
    case "expense":
      return { txs: transactions.filter((t) => t.type === "EXPENSE"), projs: [] };
    case "recurring":
      return { txs: transactions.filter((t) => t.isRecurring), projs: projections };
    default:
      return { txs: transactions, projs: projections };
  }
}

const MAX_CHIPS = 3;

export function CalendarDayCell({ cell, filter, onClick }) {
  const { day, isCurrentMonth, isToday, dayData } = cell;
  const { transactions, projections } = dayData;

  const { txs, projs } = applyFilter(transactions, projections, filter);
  const hasContent = txs.length > 0 || projs.length > 0;

  // Allocate slots: transactions first, then projections, max MAX_CHIPS total
  const visibleTxs = txs.slice(0, MAX_CHIPS);
  const remainingSlots = MAX_CHIPS - visibleTxs.length;
  const visibleProjs = projs.slice(0, remainingSlots);
  const hiddenCount = txs.length - visibleTxs.length + projs.length - visibleProjs.length;

  return (
    <button
      onClick={hasContent ? onClick : undefined}
      className={cn(
        "min-h-[90px] sm:min-h-[120px] w-full p-1 sm:p-1.5 border-b border-r text-left transition-colors relative",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isCurrentMonth ? "bg-background" : "bg-muted/20",
        hasContent && isCurrentMonth
          ? "hover:bg-accent/30 cursor-pointer"
          : "cursor-default",
        isToday && "bg-blue-50/80 dark:bg-blue-950/20"
      )}
    >
      {/* Day number */}
      <span
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[11px] sm:text-xs font-medium rounded-full mb-0.5",
          isToday
            ? "bg-primary text-primary-foreground font-bold"
            : isCurrentMonth
            ? "text-foreground"
            : "text-muted-foreground/40"
        )}
      >
        {day}
      </span>

      {/* Event chips */}
      {isCurrentMonth && hasContent && (
        <div className="flex flex-col gap-[2px] overflow-hidden">
          {visibleTxs.map((tx) => (
            <EventChip key={tx.id} tx={tx} />
          ))}
          {visibleProjs.map((proj) => (
            <ProjectionChip key={proj.id} proj={proj} />
          ))}
          {hiddenCount > 0 && (
            <span className="text-[9px] sm:text-[10px] text-muted-foreground pl-0.5 leading-none mt-0.5">
              +{hiddenCount} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function EventChip({ tx }) {
  const cat = categoryMap[tx.category];
  const label = tx.description || cat?.name || tx.category;
  const amount = formatCompact(tx.amount);
  const sign = tx.type === "INCOME" ? "+" : "-";

  return (
    <div
      className={cn(
        "flex items-center min-w-0 w-full rounded px-1 py-[2px] text-[10px] sm:text-[11px] leading-tight font-medium select-none",
        tx.type === "INCOME"
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      )}
    >
      <span className="truncate flex-1 min-w-0">{label}</span>
      <span className="flex-shrink-0 font-bold ml-0.5 tabular-nums">
        {sign}{amount}
      </span>
    </div>
  );
}

function ProjectionChip({ proj }) {
  const cat = categoryMap[proj.category];
  const label = proj.description || cat?.name || proj.category;
  const amount = formatCompact(proj.amount);
  const sign = proj.type === "INCOME" ? "+" : "-";

  return (
    <div className="flex items-center min-w-0 w-full rounded px-1 py-[2px] text-[10px] sm:text-[11px] leading-tight font-medium select-none bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
      <RefreshCw className="h-2 w-2 flex-shrink-0 mr-0.5 opacity-70" />
      <span className="truncate flex-1 min-w-0">{label}</span>
      <span className="flex-shrink-0 font-bold ml-0.5 tabular-nums">
        {sign}{amount}
      </span>
    </div>
  );
}
