/** API-ready finance client — connect to /api/v1/finance */

const BASE = "/api/v1/finance";

export async function fetchFinanceOverview() {
  const res = await fetch(BASE, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load finance data");
  return res.json();
}
