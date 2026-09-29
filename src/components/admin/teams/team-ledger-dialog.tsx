"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt } from "lucide-react";

type LedgerEntry = {
  _id: string;
  type: "CREDIT" | "DEBIT" | "ADJUSTMENT";
  amount: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
};

const TYPE_BADGE: Record<string, string> = {
  CREDIT: "border-0 bg-sold/15 text-sold",
  DEBIT: "border-0 bg-destructive/10 text-destructive",
  ADJUSTMENT: "border-0 bg-primary/15 text-primary",
};

export function TeamLedgerDialog({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/ledger`);
      setEntries(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => open && !entries && load()}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon">
            <Receipt className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{teamName} — Wallet Ledger</DialogTitle>
          <DialogDescription>
            Every credit, debit and adjustment, oldest first.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          <div className="space-y-1">
            {entries.map((txn) => (
              <div
                key={txn._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{txn.note}</p>
                  <Badge className={`${TYPE_BADGE[txn.type]} mt-1 text-[10px]`}>
                    {txn.type}
                  </Badge>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={
                      txn.amount < 0
                        ? "tabular-money font-semibold text-destructive"
                        : "tabular-money font-semibold text-sold"
                    }
                  >
                    {txn.amount < 0 ? "-" : "+"}₹
                    {Math.abs(txn.amount).toLocaleString("en-IN")}
                  </p>
                  <p className="tabular-money text-xs text-muted-foreground">
                    ₹{txn.balanceAfter.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
