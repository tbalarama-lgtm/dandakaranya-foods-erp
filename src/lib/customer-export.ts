import type { CustomerListDto } from "@/lib/customer-types";
import {
  CUSTOMER_RISK_LABELS,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/customer-types";

export function customersToCsv(customers: CustomerListDto[]): string {
  const header = [
    "Name",
    "Company",
    "Phone",
    "Email",
    "GSTIN",
    "Segment",
    "Status",
    "Credit Risk",
    "Lifetime Value",
    "Outstanding",
    "Overdue Invoices",
    "Credit Limit",
    "Country",
  ];
  const rows = customers.map((c) => [
    c.name,
    c.company ?? "",
    c.phone,
    c.email ?? "",
    c.gstin ?? "",
    CUSTOMER_SEGMENT_LABELS[c.segment],
    CUSTOMER_STATUS_LABELS[c.status],
    CUSTOMER_RISK_LABELS[c.creditRisk],
    c.lifetimeValue,
    c.outstanding,
    c.overdueCount,
    c.creditLimit ?? "",
    c.country ?? "",
  ]);
  return [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function customersToExcel(customers: CustomerListDto[]): string {
  return customersToCsv(customers).replace(/,/g, "\t");
}

export function customersToPdfHtml(customers: CustomerListDto[]): string {
  const rows = customers
    .map(
      (c) =>
        `<tr><td>${c.name}</td><td>${c.company ?? "—"}</td><td>${CUSTOMER_SEGMENT_LABELS[c.segment]}</td><td>₹${c.lifetimeValue.toLocaleString("en-IN")}</td><td>₹${c.outstanding.toLocaleString("en-IN")}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><title>Customer Export</title><style>
    body{font-family:system-ui,sans-serif;padding:24px} table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:8px;text-align:left} th{background:#1E3A5F;color:#fff}
  </style></head><body>
    <h1>Dandakaranya Foods — Customer Master</h1>
    <p>Generated ${new Date().toLocaleString("en-IN")}</p>
    <table><thead><tr><th>Name</th><th>Company</th><th>Segment</th><th>LTV</th><th>Outstanding</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
}
