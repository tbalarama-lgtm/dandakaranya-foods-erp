"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerDocType } from "@prisma/client";
import { addCustomerDocument } from "@/actions/customers";
import { CUSTOMER_DOC_LABELS } from "@/lib/customer-types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function CustomerDocuments({
  customerId,
  documents,
}: {
  customerId: string;
  documents: {
    id: string;
    docType: CustomerDocType;
    name: string;
    fileUrl: string | null;
    notes: string | null;
    uploadedAt: Date | string;
  }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<CustomerDocType>("GST_CERTIFICATE");
  const [fileUrl, setFileUrl] = useState("");

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Document management</h3>
      <p className="mt-1 text-xs text-muted-foreground">GST certificates, agreements, contracts, KYC</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as CustomerDocType)}
          className="h-9 rounded-lg border border-border px-2 text-sm"
        >
          {Object.entries(CUSTOMER_DOC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="File URL (optional)"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (!name.trim()) return;
            await addCustomerDocument(customerId, { docType, name: name.trim(), fileUrl: fileUrl || undefined });
            setName("");
            setFileUrl("");
            toast.success("Document added");
            router.refresh();
          }}
        >
          Add
        </Button>
      </div>
      <ul className="mt-4 space-y-2">
        {documents.length === 0 ? (
          <li className="text-xs text-muted-foreground">No documents on file.</li>
        ) : (
          documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{d.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{CUSTOMER_DOC_LABELS[d.docType]}</span>
                <p className="text-[10px] text-muted-foreground">{formatDate(new Date(d.uploadedAt))}</p>
              </div>
              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-[#B68D40] hover:underline">
                  View
                </a>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
