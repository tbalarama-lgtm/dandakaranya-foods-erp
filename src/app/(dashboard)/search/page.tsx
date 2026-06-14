import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [invoices, leads, products] = query
    ? await Promise.all([
        prisma.saleInvoice.findMany({
          where: {
            OR: [
              { invoiceNumber: { contains: query, mode: "insensitive" } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          include: { customer: true },
          take: 10,
        }),
        prisma.lead.findMany({
          where: {
            OR: [
              { company: { contains: query, mode: "insensitive" } },
              { contactName: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 10,
        }),
        prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 10,
        }),
      ])
    : [[], [], []];

  return (
    <div>
      <PageHeader title="Search" description="Find invoices, leads, and products" />
      <form className="mb-8">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search…"
          className="w-full max-w-xl rounded-xl border border-border bg-background px-4 py-3"
        />
      </form>
      {!query ? (
        <p className="text-muted-foreground">Enter a search term above.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ResultGroup title="Invoices" href="/sales">
            {invoices.map((i) => (
              <li key={i.id}>
                {i.invoiceNumber} — {i.customer.name} ({formatInr(Number(i.total))})
              </li>
            ))}
          </ResultGroup>
          <ResultGroup title="Leads" href="/leads">
            {leads.map((l) => (
              <li key={l.id}>
                {l.company} — {l.contactName}
              </li>
            ))}
          </ResultGroup>
          <ResultGroup title="Products" href="/products">
            {products.map((p) => (
              <li key={p.id}>
                {p.sku} — {p.name}
              </li>
            ))}
          </ResultGroup>
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Link href={href} className="font-semibold text-gold-600 hover:underline">
          {title}
        </Link>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{children}</ul>
      </CardContent>
    </Card>
  );
}
