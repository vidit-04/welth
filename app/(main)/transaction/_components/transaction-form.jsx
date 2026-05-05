"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { cn } from "@/lib/utils";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import { ReceiptScanner } from "./recipt-scanner";
import { UpiScanner } from "./upi-scanner";

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [upiData, setUpiData] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const categoryTriggerRef = useRef(null);

  useEffect(() => {
    setIsMobileDevice(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth < 768
    );
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            category: "",
            date: new Date(),
            isRecurring: false,
          },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const onSubmit = (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  const handleScanComplete = (scannedData) => {
    if (scannedData) {
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date(scannedData.date));
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }
      if (scannedData.category) {
        setValue("category", scannedData.category);
      }
      toast.success("Receipt scanned successfully");
    }
  };

  // Stores the selected app's redirect URL — kept in a ref so it doesn't
  // trigger the useEffect dependency array when updated.
  const upiRedirectUrlRef = useRef(null);

  const handleUpiScanned = (data) => {
    setUpiData(data);
    const currentType = getValues("type");
    setValue("type", "EXPENSE");
    // Only clear category if the type was INCOME — its categories don't apply to EXPENSE.
    // If the user already picked an EXPENSE category, keep it.
    if (currentType !== "EXPENSE") {
      setValue("category", "");
      setTimeout(() => categoryTriggerRef.current?.focus(), 100);
    }
    setValue("date", new Date());
    // Description intentionally NOT auto-filled — user may have pre-typed it
    if (data.am) {
      setValue("amount", data.am);
    }
  };

  const handleUpiPayAndSave = () => {
    if (!upiData?.upiUrl) return;

    // Rebuild the UPI URL with the form's current amount so the UPI app
    // always opens with the correct pre-filled amount — whether or not the
    // original QR had one.
    const qIndex = upiData.upiUrl.indexOf("?");
    const base = upiData.upiUrl.slice(0, qIndex);
    const params = new URLSearchParams(
      qIndex !== -1 ? upiData.upiUrl.slice(qIndex + 1) : ""
    );
    const formAmount = getValues("amount");
    if (formAmount) {
      params.set("am", parseFloat(formAmount).toFixed(2));
      if (!params.get("cu")) params.set("cu", "INR");
    }
    upiRedirectUrlRef.current = `${base}?${params.toString()}`;

    handleSubmit((data) => {
      transactionFn({ ...data, amount: parseFloat(data.amount) });
    })();
  };

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode ? "Transaction updated successfully" : "Transaction created successfully"
      );
      reset();

      const redirectUrl = upiRedirectUrlRef.current;
      const accountPath = `/account/${transactionResult.data.accountId}`;

      if (redirectUrl && isMobileDevice) {
        let navigated = false;
        const finish = () => {
          if (!navigated) {
            navigated = true;
            router.push(accountPath);
          }
        };
        // When user comes back from the UPI app
        const onVisibility = () => {
          if (!document.hidden) {
            document.removeEventListener("visibilitychange", onVisibility);
            finish();
          }
        };
        document.addEventListener("visibilitychange", onVisibility);
        // Fallback if UPI scheme fails (app not installed)
        setTimeout(finish, 1500);
        window.location.href = redirectUrl;
        return;
      }

      router.push(accountPath);
    }
  }, [transactionResult, transactionLoading, editMode, reset, router, isMobileDevice]);

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");
  const amount = watch("amount");

  const filteredCategories = categories.filter((c) => c.type === type);
  const canPayUpi = !!amount && parseFloat(amount) > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-6 overflow-x-hidden">
      {/* Scanners - Only show in create mode */}
      {!editMode && (
        <div className="space-y-2">
          <ReceiptScanner onScanComplete={handleScanComplete} />
          <UpiScanner
            onUpiScanned={handleUpiScanned}
            upiData={upiData}
            onReset={() => setUpiData(null)}
          />
        </div>
      )}

      {/* Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <Select
          onValueChange={(value) => {
            setValue("type", value);
            setValue("category", "");
          }}
          defaultValue={type}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-red-500">{errors.type.message}</p>
        )}
      </div>

      {/* Amount and Account */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Account</label>
          <Select
            onValueChange={(value) => setValue("accountId", value)}
            defaultValue={getValues("accountId")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} (₹{parseFloat(account.balance).toFixed(2)})
                </SelectItem>
              ))}
              <CreateAccountDrawer>
                <Button
                  variant="ghost"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  Create Account
                </Button>
              </CreateAccountDrawer>
            </SelectContent>
          </Select>
          {errors.accountId && (
            <p className="text-sm text-red-500">{errors.accountId.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          onValueChange={(value) => setValue("category", value)}
          value={watch("category")}
        >
          <SelectTrigger ref={categoryTriggerRef}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full pl-3 text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              {date ? format(date, "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => setValue("date", date)}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p className="text-sm text-red-500">{errors.date.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input placeholder="Enter description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Recurring Toggle */}
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <label className="text-base font-medium">Recurring Transaction</label>
          <div className="text-sm text-muted-foreground break-words">
            Set up a recurring schedule for this transaction
          </div>
        </div>
        <Switch
          className="self-start sm:self-auto"
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring Interval */}
      {isRecurring && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Recurring Interval</label>
          <Select
            onValueChange={(value) => setValue("recurringInterval", value)}
            defaultValue={getValues("recurringInterval")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurringInterval && (
            <p className="text-sm text-red-500">
              {errors.recurringInterval.message}
            </p>
          )}
        </div>
      )}

      {upiData && isMobileDevice ? (
        /* UPI mode — purple gradient box replaces normal buttons */
        <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 p-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              onClick={handleUpiPayAndSave}
              disabled={transactionLoading || !canPayUpi}
            >
              {transactionLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : !canPayUpi ? (
                "Enter amount first"
              ) : (
                "Pay with UPI"
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Normal mode */
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" className="w-full" disabled={transactionLoading}>
            {transactionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editMode ? "Updating..." : "Creating..."}
              </>
            ) : editMode ? (
              "Update Transaction"
            ) : (
              "Create Transaction"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
