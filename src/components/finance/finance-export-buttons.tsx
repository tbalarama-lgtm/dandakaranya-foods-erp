"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function FinanceExportButtons({ filename = "finance-report" }: { filename?: string }) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="glass-button"
        onClick={() => toast.success(`Excel export queued — ${filename}.xlsx`)}
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Excel
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="glass-button"
        onClick={() => toast.success(`PDF export queued — ${filename}.pdf`)}
      >
        <FileText className="mr-2 h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
