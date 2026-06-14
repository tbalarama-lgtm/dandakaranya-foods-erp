"use client";

import type { BankAccount, BankTransaction } from "@/lib/finance/types";
import { FinanceStatCard } from "@/components/finance/finance-stat-card";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { Landmark, Wallet } from "lucide-react";
import { formatInr } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function FinanceCashBankClient({
  accounts,
  transactions,
}: {
  accounts: BankAccount[];
  transactions: BankTransaction[];
}) {
  const empMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {accounts.map((a, i) => (
          <FinanceStatCard
            key={a.id}
            label={a.name}
            value={formatInr(a.balance)}
            sub={`${a.bankName} ${a.accountNo}`}
            icon={Landmark}
            accent={i === 0 ? "emerald" : i === 1 ? "blue" : "violet"}
            delay={i * 0.05}
          />
        ))}
      </div>
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Transaction timeline
          </h3>
        </GlassCardHeader>
        <GlassCardBody className="space-y-3">
          {transactions.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3 last:border-0">
              <div>
                <p className="font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {empMap[t.accountId]?.name} · {t.date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={t.type === "DEPOSIT" ? "text-emerald-600" : "text-rose-600"}>
                  {t.type === "DEPOSIT" ? "+" : "-"}
                  {formatInr(t.amount)}
                </span>
                <Badge variant={t.reconciled ? "success" : "warning"}>
                  {t.reconciled ? "Reconciled" : "Pending"}
                </Badge>
              </div>
            </div>
          ))}
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
