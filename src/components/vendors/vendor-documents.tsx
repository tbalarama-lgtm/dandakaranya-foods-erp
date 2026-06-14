import type { VendorDocType } from "@prisma/client";
import { VENDOR_DOC_LABELS } from "@/lib/vendor-types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  docType: VendorDocType;
  name: string;
  fileUrl: string | null;
  expiresAt: Date | null;
  uploadedAt: Date;
};

export function VendorDocuments({ documents }: { documents: Doc[] }) {
  const grouped = Object.values(
    documents.reduce(
      (acc, d) => {
        if (!acc[d.docType]) acc[d.docType] = [];
        acc[d.docType].push(d);
        return acc;
      },
      {} as Record<VendorDocType, Doc[]>,
    ),
  );

  const required: VendorDocType[] = ["GST_CERTIFICATE", "FSSAI_LICENSE", "BANK_DETAILS", "AGREEMENT", "COMPLIANCE"];
  const have = new Set(documents.map((d) => d.docType));
  const missing = required.filter((r) => !have.has(r));

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Vendor document management</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        GST certificates · agreements · FSSAI licenses · compliance · bank details
      </p>

      {missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
          <p className="text-xs font-semibold text-amber-800">Missing compliance documents</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {missing.map((m) => (
              <li key={m} className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {VENDOR_DOC_LABELS[m]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          grouped.map((docs) => (
            <div key={docs[0].docType}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {VENDOR_DOC_LABELS[docs[0].docType]}
              </h4>
              <ul className="mt-2 space-y-2">
                {docs.map((d) => {
                  const expiring = d.expiresAt && d.expiresAt < new Date(Date.now() + 30 * 86400000);
                  return (
                    <li
                      key={d.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                        expiring ? "border-amber-500/40 bg-amber-500/5" : "border-border/50",
                      )}
                    >
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {formatDate(d.uploadedAt)}
                          {d.expiresAt && ` · Expires ${formatDate(d.expiresAt)}`}
                        </p>
                      </div>
                      {d.fileUrl ? (
                        <a href={d.fileUrl} className="text-xs font-semibold text-[#B68D40] hover:underline" target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">On file</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
