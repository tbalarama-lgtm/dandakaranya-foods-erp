const BASE = "/api/v1/production";

export async function fetchProductionOverview() {
  const res = await fetch(BASE, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load production data");
  return res.json();
}
