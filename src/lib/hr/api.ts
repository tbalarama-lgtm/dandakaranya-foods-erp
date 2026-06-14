/**
 * API-ready HR client — wire to /api/v1/hr when Prisma models are fully synced.
 * UI currently uses mock data from ./mock-data.ts for demos.
 */

const BASE = "/api/v1/hr";

export async function fetchHrOverview() {
  const res = await fetch(BASE, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load HR data");
  return res.json();
}

export type HrApiResponse = {
  employees: unknown[];
  attendance: unknown[];
  leaves: unknown[];
  payrolls: unknown[];
};
