"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { recalculateAccountBalances } from "@/actions/account";

export function RecalculateButton({ accountId }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await recalculateAccountBalances(accountId);
      if (result.success) {
        toast.success("Balances recalculated");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to recalculate");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Recalculating…" : "Fix Balances"}
    </Button>
  );
}
