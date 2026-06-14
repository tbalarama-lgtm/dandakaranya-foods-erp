"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function HrExportButtons({ filename = "hr-export" }: { filename?: string }) {
  const exportFile = (type: "excel" | "pdf") => {
    toast.success(`${type === "excel" ? "Excel" : "PDF"} export queued`, {
      description: `${filename}.${type === "excel" ? "xlsx" : "pdf"} — API integration placeholder`,
    });
  };

  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" className="glass-button" onClick={() => exportFile("excel")}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" className="glass-button" onClick={() => exportFile("pdf")}>
        <FileText className="mr-2 h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
