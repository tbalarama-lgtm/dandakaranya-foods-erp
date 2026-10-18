import type Database from "better-sqlite3";
import type { DashboardCounts } from "@shared/types";
import { resolveScope } from "./coverage";

export function dashboardCounts(
  db: Database.Database,
  constituencyId: string,
  boundaryVersionId: string
): DashboardCounts {
  const scope = resolveScope(db, constituencyId, boundaryVersionId);
  const elections = (
    db
      .prepare("SELECT COUNT(*) AS c FROM elections WHERE constituency_id = ?")
      .get(constituencyId) as { c: number }
  ).c;
  return {
    mandals: Object.keys(scope.mandals).length,
    gramPanchayats: Object.keys(scope.gramPanchayats).length,
    villages: Object.keys(scope.villages).length,
    urbanLocalBodies: Object.keys(scope.urbanLocalBodies).length,
    ruralWards: Object.keys(scope.ruralWards).length,
    urbanWards: Object.keys(scope.urbanWards).length,
    electionWorkspaces: elections
  };
}
