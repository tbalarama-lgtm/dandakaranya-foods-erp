"use client";

import { useState } from "react";
import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { updateCompany } from "@/actions/settings";
import { BRAND_LOGO_HTTPS_URL, BRAND_LOGO_PUBLIC_PATH } from "@/lib/brand-logo";
import { normalizeLogoUrl } from "@/lib/logo-url";
import { toast } from "sonner";
import type { CompanyProfile } from "@prisma/client";

const TEXT_FIELDS: { key: keyof CompanyProfile; label: string }[] = [
  { key: "name", label: "Display name" },
  { key: "legalName", label: "Legal name" },
  { key: "tagline", label: "Tagline" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "gstin", label: "GSTIN" },
  { key: "website", label: "Website" },
];

export function CompanyForm({ company }: { company: CompanyProfile | null }) {
  const defaultLogo = company?.logoUrl?.trim() || BRAND_LOGO_HTTPS_URL;
  const [form, setForm] = useState({
    name: company?.name ?? "",
    legalName: company?.legalName ?? "",
    tagline: company?.tagline ?? "",
    address: company?.address ?? "",
    phone: company?.phone ?? "",
    email: company?.email ?? "",
    gstin: company?.gstin ?? "",
    website: company?.website ?? "",
    logoUrl: defaultLogo,
  });
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const previewSrc = form.logoUrl.trim() || BRAND_LOGO_PUBLIC_PATH;

  async function handleSave() {
    try {
      normalizeLogoUrl(form.logoUrl || BRAND_LOGO_HTTPS_URL);
      await updateCompany({
        ...form,
        logoUrl: form.logoUrl.trim() || BRAND_LOGO_HTTPS_URL,
      });
      toast.success("Company profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-muted/20 p-4">
          <BrandLogoImage size={64} priority />
          <div className="text-sm">
            <p className="font-medium">Brand logo</p>
            <p className="text-muted-foreground">
              Your logo is bundled with the ERP and appears on invoice PDFs automatically.
            </p>
          </div>
        </div>

        {TEXT_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              value={form[key as keyof typeof form] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1.5"
            />
          </div>
        ))}

        <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
          <Label htmlFor="logoUrl">Logo URL (for PDF invoices)</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional override. Defaults to your website logo. Invoice PDFs also use the bundled file if the URL is unreachable.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              id="logoUrl"
              type="url"
              className="min-w-[240px] flex-1"
              value={form.logoUrl}
              onChange={(e) => {
                setLogoPreviewError(false);
                setForm({ ...form, logoUrl: e.target.value });
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, logoUrl: BRAND_LOGO_HTTPS_URL })}>
              Reset to default
            </Button>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-background p-3">
            <p className="mb-2 text-xs text-muted-foreground">PDF preview source</p>
            {logoPreviewError ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                URL preview failed — PDFs will still use the bundled logo.png.
              </p>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewSrc}
                alt="Logo preview"
                className="h-20 w-20 rounded-full object-cover"
                onError={() => setLogoPreviewError(true)}
                onLoad={() => setLogoPreviewError(false)}
              />
            )}
          </div>
        </div>

        <Button onClick={handleSave}>Save profile</Button>
      </CardContent>
    </Card>
  );
}
