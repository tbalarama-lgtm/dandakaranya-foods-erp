import type Database from "better-sqlite3";
import { PAGE_SIZE } from "@shared/constants";
import type {
  CoverageKind,
  GeoBreadcrumb,
  PagedResult,
  Village,
  VillageWardMapping,
  Ward,
  WardDetail,
  WardFilters,
  WardListItem
} from "@shared/types";
import type { WardWriteInput } from "@shared/ipc";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { mapGp, mapUlb, mapVillage, mapVillageWard, mapWard } from "../db/mappers";
import { writeAudit } from "./audit";
import { resolveScope } from "./coverage";

function official(code?: string | null): string | null {
  if (code == null) return null;
  const trimmed = code.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function createWard(db: Database.Database, input: WardWriteInput, isDemo = false): Ward {
  validateWardParents(db, input);
  const id = newId();
  const ts = nowIso();
  try {
    db.prepare(
      `INSERT INTO wards (
        id, classification, gram_panchayat_id, urban_local_body_id, boundary_version_id,
        ward_number, name, name_te, official_code, record_source, last_verified_at, notes,
        archived, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(
      id,
      input.classification,
      input.classification === "rural" ? input.gramPanchayatId : null,
      input.classification === "urban" ? input.urbanLocalBodyId : null,
      input.boundaryVersionId,
      input.wardNumber.trim(),
      input.name.trim(),
      input.nameTe ?? "",
      official(input.officialCode),
      input.recordSource ?? "",
      input.lastVerifiedAt ?? null,
      input.notes ?? "",
      isDemo ? 1 : 0,
      ts,
      ts
    );
  } catch (error) {
    throw uniquenessOr(error);
  }
  if (!isDemo) {
    const kind = (db.prepare("SELECT value FROM app_meta WHERE key = 'data_kind'").get() as { value: string } | undefined)?.value;
    if (kind === "empty") db.prepare("UPDATE app_meta SET value = 'operational' WHERE key = 'data_kind'").run();
  }
  writeAudit(db, { action: "create", entityType: "ward", recordId: id, changedFields: ["wardNumber", "name", "classification"] });
  return getWard(db, id);
}

export function updateWard(db: Database.Database, input: WardWriteInput & { id: string }): Ward {
  const current = getWard(db, input.id);
  validateWardParents(db, input);
  try {
    db.prepare(
      `UPDATE wards SET
        classification = ?, gram_panchayat_id = ?, urban_local_body_id = ?, boundary_version_id = ?,
        ward_number = ?, name = ?, name_te = ?, official_code = ?, record_source = ?, last_verified_at = ?,
        notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.classification,
      input.classification === "rural" ? input.gramPanchayatId : null,
      input.classification === "urban" ? input.urbanLocalBodyId : null,
      input.boundaryVersionId,
      input.wardNumber.trim(),
      input.name.trim(),
      input.nameTe ?? "",
      official(input.officialCode),
      input.recordSource ?? "",
      input.lastVerifiedAt ?? null,
      input.notes ?? "",
      nowIso(),
      input.id
    );
  } catch (error) {
    throw uniquenessOr(error);
  }
  writeAudit(db, {
    action: "update",
    entityType: "ward",
    recordId: input.id,
    changedFields: ["wardNumber", "name", "classification", "recordSource", "lastVerifiedAt"]
  });
  return getWard(db, current.id);
}

export function archiveWard(db: Database.Database, id: string): void {
  getWard(db, id);
  db.prepare("UPDATE wards SET archived = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
  writeAudit(db, { action: "archive", entityType: "ward", recordId: id, changedFields: ["archived"] });
}

export function getWard(db: Database.Database, id: string): Ward {
  const row = db.prepare("SELECT * FROM wards WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Ward not found.");
  return mapWard(row);
}

export function getWardDetail(db: Database.Database, id: string): WardDetail {
  const ward = getWard(db, id);
  const villages = (
    db
      .prepare(
        `SELECT v.*, m.coverage_kind FROM villages v
         JOIN village_ward_mappings m ON m.village_id = v.id
         WHERE m.ward_id = ? ORDER BY v.name`
      )
      .all(id) as Array<Record<string, unknown>>
  ).map((row) => ({ ...mapVillage(row), coverageKind: String(row.coverage_kind) as CoverageKind }));

  let parent: WardDetail["parent"];
  const breadcrumb: GeoBreadcrumb = {
    ward: { id: ward.id, name: ward.name, wardNumber: ward.wardNumber, classification: ward.classification },
    villages: villages.map((v) => ({ id: v.id, name: v.name, coverageKind: v.coverageKind }))
  };
  const version = db.prepare("SELECT id, name FROM boundary_versions WHERE id = ?").get(ward.boundaryVersionId) as
    | { id: string; name: string }
    | undefined;
  if (version) breadcrumb.boundaryVersion = version;

  if (ward.classification === "rural" && ward.gramPanchayatId) {
    const gp = mapGp(db.prepare("SELECT * FROM gram_panchayats WHERE id = ?").get(ward.gramPanchayatId) as Record<string, unknown>);
    parent = gp;
    breadcrumb.gramPanchayat = { id: gp.id, name: gp.name };
    const mandal = db.prepare("SELECT id, name FROM mandals WHERE id = ?").get(gp.mandalId) as { id: string; name: string };
    breadcrumb.mandal = mandal;
  } else if (ward.urbanLocalBodyId) {
    const ulb = mapUlb(db.prepare("SELECT * FROM urban_local_bodies WHERE id = ?").get(ward.urbanLocalBodyId) as Record<string, unknown>);
    parent = ulb;
    breadcrumb.urbanLocalBody = { id: ulb.id, name: ulb.name, bodyType: ulb.bodyType };
    if (ulb.administrativeMandalId) {
      const mandal = db.prepare("SELECT id, name FROM mandals WHERE id = ?").get(ulb.administrativeMandalId) as
        | { id: string; name: string }
        | undefined;
      if (mandal) breadcrumb.mandal = mandal;
    }
  } else {
    throw new AppError("invalid_parent", "Ward is missing a parent local body.");
  }

  const referencedByElections = db
    .prepare(
      `SELECT e.id, e.name, e.status FROM elections e
       JOIN election_wards ew ON ew.election_id = e.id
       WHERE ew.ward_id = ? ORDER BY e.year DESC`
    )
    .all(id) as Array<{ id: string; name: string; status: WardDetail["referencedByElections"][number]["status"] }>;

  return { ward, breadcrumb, villages, parent, referencedByElections };
}

export function listWards(db: Database.Database, filters: WardFilters): PagedResult<WardListItem> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const params: unknown[] = [];
  const where: string[] = [];
  if (filters.boundaryVersionId) {
    where.push("w.boundary_version_id = ?");
    params.push(filters.boundaryVersionId);
  }
  if (!filters.includeArchived) where.push("w.archived = 0");
  if (filters.classification) {
    where.push("w.classification = ?");
    params.push(filters.classification);
  }
  if (filters.mandalId) {
    where.push("(gp.mandal_id = ? OR ulb.administrative_mandal_id = ?)");
    params.push(filters.mandalId, filters.mandalId);
  }
  if (filters.localBodyId) {
    where.push("(w.gram_panchayat_id = ? OR w.urban_local_body_id = ?)");
    params.push(filters.localBodyId, filters.localBodyId);
  }
  if (filters.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    where.push(
      "(w.ward_number LIKE ? OR w.name LIKE ? OR w.name_te LIKE ? OR IFNULL(gp.name,'') LIKE ? OR IFNULL(gp.name_te,'') LIKE ? OR IFNULL(ulb.name,'') LIKE ? OR IFNULL(ulb.name_te,'') LIKE ?)"
    );
    params.push(q, q, q, q, q, q, q);
  }

  let scopedIds: Set<string> | null = null;
  let scopeKinds: Record<string, CoverageKind | "inherited-complete"> = {};
  if (filters.constituencyId && filters.boundaryVersionId) {
    const scope = resolveScope(db, filters.constituencyId, filters.boundaryVersionId);
    scopedIds = new Set([...Object.keys(scope.ruralWards), ...Object.keys(scope.urbanWards)]);
    scopeKinds = { ...scope.ruralWards, ...scope.urbanWards };
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT w.*,
      CASE WHEN w.classification = 'rural' THEN gp.name ELSE ulb.name END AS parent_name,
      CASE WHEN w.classification = 'rural' THEN m.name ELSE am.name END AS mandal_name
    FROM wards w
    LEFT JOIN gram_panchayats gp ON gp.id = w.gram_panchayat_id
    LEFT JOIN mandals m ON m.id = gp.mandal_id
    LEFT JOIN urban_local_bodies ulb ON ulb.id = w.urban_local_body_id
    LEFT JOIN mandals am ON am.id = ulb.administrative_mandal_id
    ${whereSql}
    ORDER BY w.classification, CAST(w.ward_number AS INTEGER), w.ward_number, w.name
  `;
  let rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  if (scopedIds) rows = rows.filter((row) => scopedIds!.has(String(row.id)));
  const total = rows.length;
  const sliced = rows.slice((page - 1) * pageSize, page * pageSize);
  const items: WardListItem[] = sliced.map((row) => {
    const ward = mapWard(row);
    const villageNames = (
      db
        .prepare(
          `SELECT v.name FROM villages v JOIN village_ward_mappings m ON m.village_id = v.id WHERE m.ward_id = ? ORDER BY v.name`
        )
        .all(ward.id) as Array<{ name: string }>
    ).map((v) => v.name);
    return {
      ...ward,
      parentName: String(row.parent_name ?? ""),
      mandalName: row.mandal_name ? String(row.mandal_name) : null,
      constituencyCoverageKind: scopeKinds[ward.id] ?? "unmapped",
      villageNames
    };
  });
  return { items, total, page, pageSize };
}

export function setVillageWard(
  db: Database.Database,
  input: { villageId: string; wardId: string; coverageKind: CoverageKind; notes?: string }
): VillageWardMapping {
  const ward = getWard(db, input.wardId);
  const village = db.prepare("SELECT * FROM villages WHERE id = ?").get(input.villageId) as Record<string, unknown> | undefined;
  if (!village) throw new AppError("not_found", "Village not found.");
  if (ward.classification !== "rural") {
    throw new AppError("invalid_mapping", "Only rural wards can be mapped to villages.");
  }
  if (ward.gramPanchayatId !== String(village.gram_panchayat_id)) {
    throw new AppError("invalid_mapping", "A ward can only map villages from its own Gram Panchayat.");
  }
  const existing = db
    .prepare("SELECT id FROM village_ward_mappings WHERE village_id = ? AND ward_id = ?")
    .get(input.villageId, input.wardId) as { id: string } | undefined;
  const id = existing?.id ?? newId();
  if (existing) {
    db.prepare("UPDATE village_ward_mappings SET coverage_kind = ?, notes = ? WHERE id = ?").run(
      input.coverageKind,
      input.notes ?? "",
      id
    );
  } else {
    db.prepare(
      "INSERT INTO village_ward_mappings (id, village_id, ward_id, coverage_kind, notes) VALUES (?, ?, ?, ?, ?)"
    ).run(id, input.villageId, input.wardId, input.coverageKind, input.notes ?? "");
  }
  writeAudit(db, {
    action: existing ? "update" : "create",
    entityType: "village_ward_mapping",
    recordId: id,
    changedFields: ["coverageKind"]
  });
  return mapVillageWard(db.prepare("SELECT * FROM village_ward_mappings WHERE id = ?").get(id) as Record<string, unknown>);
}

export function deleteVillageWard(db: Database.Database, id: string): void {
  const info = db.prepare("DELETE FROM village_ward_mappings WHERE id = ?").run(id);
  if (info.changes === 0) throw new AppError("not_found", "Village-to-ward mapping not found.");
  writeAudit(db, { action: "delete", entityType: "village_ward_mapping", recordId: id, changedFields: [] });
}

export function listVillageWards(db: Database.Database, wardId: string): VillageWardMapping[] {
  return (db.prepare("SELECT * FROM village_ward_mappings WHERE ward_id = ?").all(wardId) as Record<string, unknown>[]).map(
    mapVillageWard
  );
}

function validateWardParents(db: Database.Database, input: WardWriteInput): void {
  if (!input.wardNumber.trim() || !input.name.trim()) {
    throw new AppError("validation", "Ward number and name are required.");
  }
  const version = db.prepare("SELECT id FROM boundary_versions WHERE id = ?").get(input.boundaryVersionId);
  if (!version) throw new AppError("invalid_parent", "Boundary version not found.");
  if (input.classification === "rural") {
    if (!input.gramPanchayatId || input.urbanLocalBodyId) {
      throw new AppError("invalid_parent", "Rural wards must belong to a Gram Panchayat and not an urban local body.");
    }
    const gp = db.prepare("SELECT id FROM gram_panchayats WHERE id = ?").get(input.gramPanchayatId);
    if (!gp) throw new AppError("invalid_parent", "Gram Panchayat not found.");
  } else {
    if (!input.urbanLocalBodyId || input.gramPanchayatId) {
      throw new AppError("invalid_parent", "Urban wards must belong to an urban local body and not a Gram Panchayat.");
    }
    const ulb = db.prepare("SELECT id FROM urban_local_bodies WHERE id = ?").get(input.urbanLocalBodyId);
    if (!ulb) throw new AppError("invalid_parent", "Urban local body not found.");
  }
}

function uniquenessOr(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ux_rural_ward_number") || message.includes("ux_urban_ward_number") || message.includes("UNIQUE")) {
    return new AppError(
      "duplicate_ward_number",
      "Ward numbers must be unique within the same parent local body and boundary version."
    );
  }
  if (error instanceof Error) return error;
  return new AppError("unexpected", message);
}

export function searchVillagesByGp(db: Database.Database, gramPanchayatId: string): Village[] {
  return (db.prepare("SELECT * FROM villages WHERE gram_panchayat_id = ? AND archived = 0 ORDER BY name").all(gramPanchayatId) as Record<string, unknown>[]).map(
    mapVillage
  );
}
