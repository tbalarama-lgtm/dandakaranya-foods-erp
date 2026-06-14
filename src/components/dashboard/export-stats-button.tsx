"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ExportStatsButton() {
  const onExport = async () => {
    try {
      const res = await fetch("/api/v1/reports/export?format=json");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp-stats-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Statistics exported");
    } catch {
      toast.error("Could not export statistics");
    }
  };

  return (
    <Button variant="outline" size="sm" className="glass-button" onClick={onExport}>
      <Download className="h-4 w-4" />
      Export statistics
    </Button>
  );
}
