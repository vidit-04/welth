"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  BellOff,
  StopCircle,
  CalendarClock,
  RefreshCw,
  SkipForward,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { defaultCategories } from "@/data/categories";
import { cn } from "@/lib/utils";
import {
  toggleRecurringReminder,
  cancelRecurringTransaction,
  skipNextOccurrence,
  updateRecurringTransaction,
} from "@/actions/recurring";

const INTERVAL_LABELS  = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly" };
const INTERVAL_SHORT   = { DAILY: "D",     WEEKLY: "W",      MONTHLY: "M",       YEARLY:  "Y" };
const INTERVAL_ACCENT  = {
  DAILY:   "bg-orange-400",
  WEEKLY:  "bg-blue-400",
  MONTHLY: "bg-violet-500",
  YEARLY:  "bg-emerald-500",
};
const INTERVAL_PILL_ON  = {
  DAILY:   "bg-orange-500 text-white",
  WEEKLY:  "bg-blue-500 text-white",
  MONTHLY: "bg-violet-500 text-white",
  YEARLY:  "bg-emerald-500 text-white",
};

const categoryMap = Object.fromEntries(defaultCategories.map((c) => [c.id, c]));
const FILTERS = ["ALL", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

const toUTCMidnight = (d) => {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
};

export function RecurringList({ initialTransactions }) {
  const router = useRouter();
  const [transactions, setTransactions]   = useState(initialTransactions);
  const [filter, setFilter]               = useState("ALL");
  const [loadingId, setLoadingId]         = useState(null);

  // Amount inline edit
  const [editAmountId, setEditAmountId]   = useState(null);
  const [editAmountVal, setEditAmountVal] = useState("");

  // Date picker per card (pending selection before Apply)
  const [pendingDateId, setPendingDateId] = useState(null);
  const [pendingDate, setPendingDate]     = useState(null);

  const filtered =
    filter === "ALL" ? transactions
    : transactions.filter((t) => t.recurringInterval === filter);

  /* ── helpers ── */
  function patch(id, changes) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...changes } : t))
    );
  }

  async function save(id, payload, optimistic) {
    setLoadingId(id);
    if (optimistic) patch(id, optimistic);
    try {
      const result = await updateRecurringTransaction(id, payload);
      patch(id, {
        amount:             result.data.amount,
        nextRecurringDate:  result.data.nextRecurringDate,
        recurringInterval:  result.data.recurringInterval,
      });
      router.refresh();
    } catch {
      if (optimistic) patch(id, /* rollback not tracked — refresh fixes it */ {});
      toast.error("Failed to save");
    } finally {
      setLoadingId(null);
    }
  }

  /* ── amount ── */
  function startAmountEdit(t) {
    setEditAmountId(t.id);
    setEditAmountVal(String(t.amount));
  }
  async function commitAmount(id) {
    const v = parseFloat(editAmountVal);
    if (isNaN(v) || v <= 0) { toast.error("Amount must be positive"); return; }
    setEditAmountId(null);
    await save(id, { amount: v }, { amount: v });
    toast.success("Amount updated");
  }

  /* ── interval (immediate, one-tap) ── */
  async function changeInterval(id, interval, currentInterval) {
    if (interval === currentInterval) return;
    await save(id, { recurringInterval: interval }, { recurringInterval: interval });
    toast.success(`Changed to ${INTERVAL_LABELS[interval]}`);
  }

  /* ── date ── */
  async function applyDate(id) {
    if (!pendingDate) return;
    const iso = toUTCMidnight(pendingDate).toISOString();
    setPendingDateId(null);
    setPendingDate(null);
    await save(id, { nextRecurringDate: iso }, { nextRecurringDate: iso });
    toast.success("Next date updated");
  }

  /* ── reminder ── */
  async function handleToggleReminder(id, current) {
    setLoadingId(id);
    patch(id, { reminderEnabled: !current });
    try {
      await toggleRecurringReminder(id, !current);
      toast.success(!current ? "Reminders enabled" : "Reminders disabled");
      router.refresh();
    } catch {
      patch(id, { reminderEnabled: current });
      toast.error("Failed to update reminder");
    } finally {
      setLoadingId(null);
    }
  }

  /* ── skip ── */
  async function handleSkip(id, currentNext) {
    if (!window.confirm(`Skip the next occurrence on ${format(new Date(currentNext), "dd MMM yyyy")}?`)) return;
    setLoadingId(id);
    try {
      const result = await skipNextOccurrence(id);
      patch(id, { nextRecurringDate: result.data.nextRecurringDate });
      toast.success("Next occurrence skipped");
      router.refresh();
    } catch {
      toast.error("Failed to skip");
    } finally {
      setLoadingId(null);
    }
  }

  /* ── cancel recurring ── */
  async function handleCancel(id, description) {
    if (!window.confirm(`Stop recurring for "${description || "this transaction"}"? Past entries are not affected.`)) return;
    setLoadingId(id);
    try {
      await cancelRecurringTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      toast.success("Recurring cancelled");
      router.refresh();
    } catch {
      toast.error("Failed to cancel");
    } finally {
      setLoadingId(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
        <RefreshCw className="h-10 w-10 opacity-30" />
        <p className="text-lg font-medium">No recurring transactions</p>
        <p className="text-sm">Create a transaction and enable the recurring toggle to get started.</p>
        <Link href="/transaction/create"><Button className="mt-2">Add Transaction</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interval filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "ALL" ? "All" : INTERVAL_LABELS[f]}
            <span className="ml-1.5 opacity-70">
              {f === "ALL" ? transactions.length : transactions.filter((t) => t.recurringInterval === f).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No {INTERVAL_LABELS[filter]?.toLowerCase()} recurring transactions.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const category = categoryMap[t.category];
            const isLoading = loadingId === t.id;
            const supportsReminder = t.recurringInterval === "MONTHLY" || t.recurringInterval === "YEARLY";

            return (
              <Card key={t.id} className="min-w-0 overflow-hidden">
                {/* Interval colour stripe */}
                <div className={cn("h-1 w-full", INTERVAL_ACCENT[t.recurringInterval])} />

                <CardContent className="p-4 space-y-4">

                  {/* Description + account + category */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm">{t.description || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">{t.account?.name}</p>
                    </div>
                    {category && <Badge variant="outline" className="shrink-0 text-xs">{category.name}</Badge>}
                  </div>

                  {/* ── Amount row ── click value to edit inline */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Amount</span>
                    {editAmountId === t.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">₹</span>
                        <Input
                          autoFocus
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editAmountVal}
                          onChange={(e) => setEditAmountVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitAmount(t.id);
                            if (e.key === "Escape") setEditAmountId(null);
                          }}
                          className="h-7 w-28 text-right text-sm"
                        />
                        <button onClick={() => commitAmount(t.id)} className="text-green-500 hover:text-green-600">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditAmountId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={isLoading}
                        onClick={() => startAmountEdit(t)}
                        className={cn(
                          "group flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-primary",
                          t.type === "EXPENSE" ? "text-red-500" : "text-green-500"
                        )}
                      >
                        {t.type === "EXPENSE" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        ₹{t.amount.toFixed(2)}
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                      </button>
                    )}
                  </div>

                  {/* ── Next date row ── click to open calendar popover */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Next</span>
                    <Popover
                      open={pendingDateId === t.id}
                      onOpenChange={(open) => {
                        if (open) { setPendingDateId(t.id); setPendingDate(t.nextRecurringDate ? new Date(t.nextRecurringDate) : null); }
                        else { setPendingDateId(null); setPendingDate(null); }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          disabled={isLoading}
                          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          {t.nextRecurringDate
                            ? format(new Date(t.nextRecurringDate), "dd MMM yyyy")
                            : "Not set"}
                          <Pencil className="h-3 w-3 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={pendingDate ?? undefined}
                          onSelect={(d) => setPendingDate(d ?? null)}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                        <div className="border-t p-2 flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => applyDate(t.id)} disabled={!pendingDate}>
                            Apply
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setPendingDateId(null); setPendingDate(null); }}>
                            Cancel
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* ── Interval pill selector ── tap to switch immediately */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Repeats</span>
                    <div className="flex gap-1">
                      {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] ).map((iv) => (
                        <button
                          key={iv}
                          disabled={isLoading}
                          onClick={() => changeInterval(t.id, iv, t.recurringInterval)}
                          title={INTERVAL_LABELS[iv]}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                            t.recurringInterval === iv
                              ? INTERVAL_PILL_ON[iv]
                              : "bg-muted text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          {INTERVAL_SHORT[iv]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Last processed */}
                  {t.lastProcessed && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3 shrink-0" />
                      Last ran {format(new Date(t.lastProcessed), "dd MMM yyyy")}
                    </div>
                  )}

                  {/* Reminder toggle (monthly/yearly only) */}
                  {supportsReminder && (
                    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        {t.reminderEnabled
                          ? <Bell className="h-3.5 w-3.5 text-violet-500" />
                          : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={t.reminderEnabled ? "font-medium text-violet-600" : "text-muted-foreground"}>
                          {t.reminderEnabled ? "Reminders on" : "Reminders off"}
                        </span>
                      </div>
                      <Switch
                        checked={t.reminderEnabled}
                        disabled={isLoading}
                        onCheckedChange={() => handleToggleReminder(t.id, t.reminderEnabled)}
                      />
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground flex-1"
                      disabled={isLoading || !t.nextRecurringDate}
                      onClick={() => handleSkip(t.id, t.nextRecurringDate)}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      Skip next
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-red-400 hover:text-red-500 hover:bg-red-50 flex-1"
                      disabled={isLoading}
                      onClick={() => handleCancel(t.id, t.description)}
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      Stop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
