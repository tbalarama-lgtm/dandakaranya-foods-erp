"use client";

import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { ProductionStatusBadge } from "@/components/production/status-badge";
import { ProductionExportButtons } from "@/components/production/production-export-buttons";
import { formatInr, toNumber } from "@/lib/utils";

type RecipeRow = {
  id: string;
  name: string;
  productName: string;
  yieldQty: number;
  yieldUnit: string;
  active: boolean;
};

type BatchRow = {
  id: string;
  batchCode: string;
  productName: string;
  status: string;
  plannedQty: number;
  actualQty: number | null;
  totalCost: number;
};

type LogRow = {
  id: string;
  batchCode: string;
  logDate: string;
  outputQty: number;
  notes: string | null;
};

export function ProductionRecipesClient({ recipes }: { recipes: RecipeRow[] }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ProductionExportButtons filename="recipes" />
      </div>
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Recipe</th>
                <th className="px-4 py-2">Output product</th>
                <th className="px-4 py-2">Yield</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No recipes in database — seed or create via API
                  </td>
                </tr>
              ) : (
                recipes.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2">{r.productName}</td>
                    <td className="px-4 py-2">{r.yieldQty} {r.yieldUnit}</td>
                    <td className="px-4 py-2">
                      <ProductionStatusBadge status={r.active ? "ACTIVE" : "OFFLINE"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function ProductionLogsClient({ logs }: { logs: LogRow[] }) {
  return (
    <div className="space-y-6">
      <ProductionExportButtons filename="production-logs" />
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Batch</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Output</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No production logs yet</td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{l.batchCode}</td>
                    <td className="px-4 py-2">{new Date(l.logDate).toLocaleString()}</td>
                    <td className="px-4 py-2">{l.outputQty} kg</td>
                    <td className="px-4 py-2 text-muted-foreground">{l.notes ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function ProductionCostsClient({ batches }: { batches: BatchRow[] }) {
  const total = batches.reduce((s, b) => s + b.totalCost, 0);
  return (
    <div className="space-y-6">
      <GlassCard glow="emerald">
        <GlassCardBody>
          <p className="text-xs text-muted-foreground">Total production cost (visible batches)</p>
          <p className="text-3xl font-semibold">{formatInr(total)}</p>
        </GlassCardBody>
      </GlassCard>
      <ProductionExportButtons filename="production-costs" />
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Batch</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Planned</th>
                <th className="px-4 py-2">Actual</th>
                <th className="px-4 py-2">Cost</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No batch cost data</td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{b.batchCode}</td>
                    <td className="px-4 py-2">{b.productName}</td>
                    <td className="px-4 py-2">{b.plannedQty} kg</td>
                    <td className="px-4 py-2">{b.actualQty ?? "—"}</td>
                    <td className="px-4 py-2">{formatInr(b.totalCost)}</td>
                    <td className="px-4 py-2"><ProductionStatusBadge status={b.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function mapRecipesFromPrisma(
  rows: { id: string; name: string; yieldQty: unknown; yieldUnit: string; active: boolean; outputProduct: { name: string } }[],
): RecipeRow[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    productName: r.outputProduct.name,
    yieldQty: toNumber(r.yieldQty),
    yieldUnit: r.yieldUnit,
    active: r.active,
  }));
}

export function mapBatchesFromPrisma(
  rows: {
    id: string;
    batchCode: string;
    status: string;
    plannedQty: unknown;
    actualQty: unknown | null;
    totalCost: unknown;
    recipe: { outputProduct: { name: string } };
  }[],
): BatchRow[] {
  return rows.map((b) => ({
    id: b.id,
    batchCode: b.batchCode,
    productName: b.recipe.outputProduct.name,
    status: b.status,
    plannedQty: toNumber(b.plannedQty),
    actualQty: b.actualQty != null ? toNumber(b.actualQty) : null,
    totalCost: toNumber(b.totalCost),
  }));
}

export function mapLogsFromPrisma(
  rows: { id: string; logDate: Date; outputQty: unknown; notes: string | null; batch: { batchCode: string } }[],
): LogRow[] {
  return rows.map((l) => ({
    id: l.id,
    batchCode: l.batch.batchCode,
    logDate: l.logDate.toISOString(),
    outputQty: toNumber(l.outputQty),
    notes: l.notes,
  }));
}
