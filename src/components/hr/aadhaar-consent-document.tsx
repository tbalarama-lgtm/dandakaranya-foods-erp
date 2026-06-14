"use client";

import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import {
  AADHAAR_CONSENT_PURPOSES,
  AADHAAR_CONSENT_STATEMENT,
  AADHAAR_CONSENT_TITLE,
  consentPdfFilename,
  type AadhaarConsentFormData,
} from "@/lib/hr/aadhaar-consent";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  data: AadhaarConsentFormData;
  employeeId?: string;
  backHref: string;
  companyName?: string;
  companyAddress?: string;
  companyContact?: string;
};

export function AadhaarConsentDocument({
  data,
  employeeId,
  backHref,
  companyName = "Dandakaranya Foods",
  companyAddress,
  companyContact,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  const onPrint = () => window.print();

  const onDownloadPdf = async () => {
    setDownloading(true);
    try {
      const apiUrl = employeeId
        ? `/api/hr/employees/${employeeId}/aadhaar-consent`
        : "/api/hr/aadhaar-consent";
      const res = await fetch(apiUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to generate PDF");
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = employeeId
        ? consentPdfFilename(data.employeeNo || "employee")
        : "Aadhaar-Consent-Blank.pdf";
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Consent form downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="aadhaar-consent-document space-y-4">
      <div className="print-hidden flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button size="sm" onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button size="sm" variant="secondary" disabled={downloading} onClick={onDownloadPdf}>
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
      </div>

      <article className="aadhaar-consent-sheet mx-auto max-w-[210mm] rounded-xl border border-border bg-white p-8 text-gray-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-10 print:shadow-none">
        <header className="flex gap-4 border-b border-gray-300 pb-6">
          <BrandLogoImage size={56} />
          <div>
            <p className="text-lg font-bold text-gray-900">{companyName}</p>
            {companyAddress ? <p className="mt-1 text-sm text-gray-600">{companyAddress}</p> : null}
            {companyContact ? <p className="text-sm text-gray-600">{companyContact}</p> : null}
          </div>
        </header>

        <div className="mt-6 flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">{AADHAAR_CONSENT_TITLE}</h1>
          <p className="text-sm text-gray-600 whitespace-nowrap">Date: {data.documentDate}</p>
        </div>

        <section className="mt-6 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
          <Field label="Employee name" value={data.employeeName} />
          <Field label="Employee ID" value={data.employeeNo} />
          <Field label="Designation" value={data.designation} />
          <Field label="Department" value={data.department} />
          <Field label="Branch" value={data.branchName} />
          <Field label="Phone" value={data.phone} />
          <Field label="Email" value={data.email} />
          <Field label="Aadhaar (masked)" value={data.aadhaarMasked || "________________"} />
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Declaration &amp; consent</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-900">{AADHAAR_CONSENT_STATEMENT}</p>

          <p className="mt-5 text-sm text-gray-700">
            I understand that my Aadhaar details may be used for the following purposes:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-800">
            {AADHAAR_CONSENT_PURPOSES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>

          <ul className="mt-5 space-y-2 text-sm leading-relaxed text-gray-800">
            <li>
              I confirm that the Aadhaar number provided is my own and is correct to the best of my knowledge.
            </li>
            <li>
              I authorize Dandakaranya Foods to verify and store my Aadhaar information solely for the purposes
              stated above.
            </li>
            <li>
              I have been informed that I may withdraw this consent in writing, subject to statutory and employment
              requirements.
            </li>
          </ul>

          {data.isAuthorized && data.authorizedAt ? (
            <p className="mt-4 text-sm font-medium text-emerald-800">
              Digital record on file: authorized{" "}
              {new Date(data.authorizedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </section>

        <section className="mt-12 grid gap-8 sm:grid-cols-2">
          <SignatureBlock title="Employee signature" hint="Sign above your printed name and date" />
          <SignatureBlock title="HR / Authorized signatory" hint="Name, designation & date" />
        </section>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
          Retain a signed copy in the employee personnel file. System reference:{" "}
          {data.employeeNo || "—"}
        </footer>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-1 min-h-[1.25rem] border-b border-gray-300 pb-0.5 text-sm font-medium text-gray-900">
        {value?.trim() || "\u00A0"}
      </dd>
    </div>
  );
}

function SignatureBlock({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-300 p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-xs text-gray-500">{hint}</p>
      <div className="mt-10 border-b border-gray-400" />
      <p className="mt-2 text-xs text-gray-500">Date: _______________________</p>
    </div>
  );
}
