import type Database from "better-sqlite3";
import { AppError } from "../errors";
import { resolveScope } from "./coverage";

export function assertWardInConstituency(
  db: Database.Database,
  constituencyId: string,
  wardId: string,
  boundaryVersionId: string
): void {
  const ward = db
    .prepare("SELECT id, classification, boundary_version_id FROM wards WHERE id = ?")
    .get(wardId) as { id: string; classification: "rural" | "urban"; boundary_version_id: string } | undefined;
  if (!ward) throw new AppError("not_found", "Ward not found.");
  if (ward.boundary_version_id !== boundaryVersionId) {
    throw new AppError("invalid_ward_assignment", "Ward does not belong to the selected boundary version.");
  }
  const scope = resolveScope(db, constituencyId, boundaryVersionId);
  const inScope = ward.classification === "rural" ? scope.ruralWards[wardId] : scope.urbanWards[wardId];
  if (!inScope) {
    throw new AppError(
      "invalid_ward_assignment",
      "This ward is not in the selected constituency coverage for the boundary version."
    );
  }
}

export function indexWardsByNumber(
  db: Database.Database,
  constituencyId: string,
  boundaryVersionId: string
): Map<string, Array<{ id: string; label: string }>> {
  const scope = resolveScope(db, constituencyId, boundaryVersionId);
  const ids = [...Object.keys(scope.ruralWards), ...Object.keys(scope.urbanWards)];
  const map = new Map<string, Array<{ id: string; label: string }>>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT w.id, w.ward_number, w.name, w.classification,
              COALESCE(gp.name, ulb.name) AS parent_name
       FROM wards w
       LEFT JOIN gram_panchayats gp ON gp.id = w.gram_panchayat_id
       LEFT JOIN urban_local_bodies ulb ON ulb.id = w.urban_local_body_id
       WHERE w.boundary_version_id = ? AND w.archived = 0 AND w.id IN (${placeholders})`
    )
    .all(boundaryVersionId, ...ids) as Array<{
    id: string;
    ward_number: string;
    name: string;
    classification: string;
    parent_name: string;
  }>;
  for (const row of rows) {
    const label = `${row.classification === "rural" ? "Rural" : "Urban"} ${row.ward_number} — ${row.name} (${row.parent_name})`;
    const list = map.get(row.ward_number) ?? [];
    list.push({ id: row.id, label });
    map.set(row.ward_number, list);
  }
  return map;
}

export function findWardsByNumber(
  db: Database.Database,
  constituencyId: string,
  boundaryVersionId: string,
  wardNumber: string
): Array<{ id: string; label: string }> {
  const trimmed = wardNumber.trim();
  if (!trimmed) return [];
  const scope = resolveScope(db, constituencyId, boundaryVersionId);
  const ids = [...Object.keys(scope.ruralWards), ...Object.keys(scope.urbanWards)];
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT w.id, w.ward_number, w.name, w.classification,
              COALESCE(gp.name, ulb.name) AS parent_name
       FROM wards w
       LEFT JOIN gram_panchayats gp ON gp.id = w.gram_panchayat_id
       LEFT JOIN urban_local_bodies ulb ON ulb.id = w.urban_local_body_id
       WHERE w.boundary_version_id = ? AND w.archived = 0 AND w.ward_number = ? AND w.id IN (${placeholders})`
    )
    .all(boundaryVersionId, trimmed, ...ids) as Array<{
    id: string;
    ward_number: string;
    name: string;
    classification: string;
    parent_name: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    label: `${row.classification === "rural" ? "Rural" : "Urban"} ${row.ward_number} — ${row.name} (${row.parent_name})`
  }));
}
