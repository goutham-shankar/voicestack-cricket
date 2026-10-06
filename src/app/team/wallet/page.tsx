import { auth } from "@/auth";
import { getUserTeam, getUserTeamId } from "@/lib/session-team";
import { getTeamLedger, getLedgerSummary } from "@/lib/services/wallet-ledger";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingDown, PiggyBank } from "lucide-react";

const TYPE_BADGE: Record<string, string> = {
  CREDIT: "border-0 bg-sold/15 text-sold",
  DEBIT: "border-0 bg-destructive/10 text-destructive",
  ADJUSTMENT: "border-0 bg-primary/15 text-primary",
};

export default async function TeamWalletPage() {
  const session = await auth();

  const team = await getUserTeam(session?.user?.id);
  const teamId = await getUserTeamId(session?.user?.id);

  const [ledger, summary] = teamId
    ? await Promise.all([getTeamLedger(teamId), getLedgerSummary(teamId)])
    : [[], { remaining: 0, spent: 0, hasLedger: false }];

  const initialBudget = team?.initialBudget ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Full transaction ledger for every purchase your team has made.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Starting Balance"
          value={`₹${initialBudget.toLocaleString("en-IN")}`}
          icon={PiggyBank}
        />
        <StatCard
          label="Spent"
          value={`₹${summary.spent.toLocaleString("en-IN")}`}
          icon={TrendingDown}
        />
        <StatCard
          label="Remaining Balance"
          value={`₹${summary.remaining.toLocaleString("en-IN")}`}
          icon={Wallet}
          accent="gold"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Note</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((txn) => (
                  <TableRow key={txn._id}>
                    <TableCell className="font-medium">{txn.note}</TableCell>
                    <TableCell>
                      <Badge className={TYPE_BADGE[txn.type]}>{txn.type}</Badge>
                    </TableCell>
                    <TableCell
                      className={
                        txn.amount < 0
                          ? "tabular-money text-destructive"
                          : "tabular-money text-sold"
                      }
                    >
                      {txn.amount < 0 ? "-" : "+"}₹
                      {Math.abs(txn.amount).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right tabular-money">
                      ₹{txn.balanceAfter.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
