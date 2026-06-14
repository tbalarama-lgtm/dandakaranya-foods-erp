import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const accounts = await safeQuery(
    () => prisma.ledgerAccount.findMany({ orderBy: { code: "asc" }, take: 20 }),
    [],
  );

  return (
    <>
      <FinancePageHeader title="General ledger" description="Chart of accounts and journal entries." />
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No ledger accounts — run db:seed
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border/40">
                    <td className="px-4 py-2 font-mono">{a.code}</td>
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-4 py-2">{a.type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </>
  );
}
