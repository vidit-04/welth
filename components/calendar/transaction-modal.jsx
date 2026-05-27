"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Plus,
  Pencil,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultCategories } from "@/data/categories";
import Link from "next/link";

const categoryMap = Object.fromEntries(defaultCategories.map((c) => [c.id, c]));

const INTERVAL_LABEL = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function TransactionModal({ isOpen, onClose, dateStr, dayData }) {
  if (!dateStr || !dayData) return null;

  const { transactions, projections } = dayData;
  const income = transactions.filter((t) => t.type === "INCOME");
  const expenses = transactions.filter((t) => t.type === "EXPENSE");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;
  const isEmpty = transactions.length === 0 && projections.length === 0;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[88vh] flex flex-col">
        <DrawerHeader className="border-b pb-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DrawerTitle className="text-base font-semibold leading-tight">
                {formatDisplayDate(dateStr)}
              </DrawerTitle>
              <DrawerDescription className="mt-1.5 flex flex-wrap items-center gap-3">
                {totalIncome > 0 && (
                  <span className="flex items-center gap-1 text-green-600 font-medium text-sm">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {formatCurrency(totalIncome)}
                  </span>
                )}
                {totalExpense > 0 && (
                  <span className="flex items-center gap-1 text-red-600 font-medium text-sm">
                    <TrendingDown className="h-3.5 w-3.5" />
                    {formatCurrency(totalExpense)}
                  </span>
                )}
                {totalIncome > 0 && totalExpense > 0 && (
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      net >= 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    Net: {net >= 0 ? "+" : ""}
                    {formatCurrency(net)}
                  </span>
                )}
              </DrawerDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/transaction/create" onClick={onClose}>
                <Button size="sm" className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </Link>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {isEmpty && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No transactions on this date.
            </p>
          )}

          {income.length > 0 && (
            <TransactionSection
              title="Income"
              total={totalIncome}
              totalClass="text-green-600"
              items={income}
              onClose={onClose}
            />
          )}

          {expenses.length > 0 && (
            <TransactionSection
              title="Expenses"
              total={totalExpense}
              totalClass="text-red-600"
              items={expenses}
              onClose={onClose}
            />
          )}

          {projections.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                    Upcoming Recurring
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">Projected</span>
              </div>
              <div className="space-y-2">
                {projections.map((proj) => {
                  const cat = categoryMap[proj.category];
                  return (
                    <div
                      key={proj.id}
                      className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat?.color || "#a855f7" }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {proj.description || cat?.name || proj.category}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {INTERVAL_LABEL[proj.recurringInterval] || proj.recurringInterval}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-bold ml-3 flex-shrink-0",
                          proj.type === "INCOME" ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {proj.type === "EXPENSE" ? "-" : "+"}
                        {formatCurrency(proj.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function TransactionSection({ title, total, totalClass, items, onClose }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={cn("text-sm font-bold", totalClass)}>
          {formatCurrency(total)}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((tx) => {
          const cat = categoryMap[tx.category];
          return (
            <div
              key={tx.id}
              className="group flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat?.color || "#94a3b8" }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tx.description || cat?.name || tx.category}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {cat?.name || tx.category}
                    </span>
                    {tx.account?.name && (
                      <span className="text-xs text-muted-foreground/60">
                        · {tx.account.name}
                      </span>
                    )}
                    {tx.isRecurring && tx.recurringInterval && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] py-0 px-1 h-3.5 leading-none"
                      >
                        {INTERVAL_LABEL[tx.recurringInterval]}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span
                  className={cn(
                    "text-sm font-bold",
                    tx.type === "INCOME" ? "text-green-600" : "text-red-600"
                  )}
                >
                  {tx.type === "EXPENSE" ? "-" : "+"}
                  {formatCurrency(tx.amount)}
                </span>
                <Link
                  href={`/transaction/create?edit=${tx.id}`}
                  onClick={onClose}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit transaction"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
