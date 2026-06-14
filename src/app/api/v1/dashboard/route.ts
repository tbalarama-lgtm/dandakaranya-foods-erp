import { apiHandler, jsonOk } from "@/lib/api/handler";
import { getErpDashboardMetrics } from "@/lib/erp-metrics";

export const GET = apiHandler(
  async () => {
    const data = await getErpDashboardMetrics();
    return jsonOk(data);
  },
  { permission: "dashboard.view" },
);
