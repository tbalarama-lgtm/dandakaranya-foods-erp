import { NextRequest } from "next/server";
import { getCustomers } from "@/lib/customer-metrics";
import { customersToCsv, customersToExcel, customersToPdfHtml } from "@/lib/customer-export";
import { requirePermission } from "@/lib/session";

export async function GET(req: NextRequest) {
  await requirePermission("sales.view");
  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const customers = await getCustomers();

  if (format === "excel") {
    return new Response(customersToExcel(customers), {
      headers: {
        "Content-Type": "application/vnd.ms-excel;charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${Date.now()}.xls"`,
      },
    });
  }

  if (format === "pdf") {
    return new Response(customersToPdfHtml(customers), {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  }

  return new Response(customersToCsv(customers), {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${Date.now()}.csv"`,
    },
  });
}
