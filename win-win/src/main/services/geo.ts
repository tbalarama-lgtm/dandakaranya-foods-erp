import type Database from "better-sqlite3";
import type {
  AssemblyConstituency,
  BoundaryStatus,
  BoundaryVersion,
  GramPanchayat,
  Mandal,
  UrbanBodyType,
  UrbanLocalBody,
  Village
} from "@shared/types";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { mapBoundary, mapGp, mapNamed, mapUlb, mapVillage } from "../db/mappers";
import { writeAudit } from "./audit";
import { resolveScope } from "./coverage";

function official(code?: string | null): string | null {
  if (code == null) return null;
  const trimmed = code.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function markOperational(db: Database.Database, isDemo: boolean): void {
  if (isDemo) return;
  const kind = (
    db.prepare("SELECT value FROM app_meta WHERE key = 'data_kind'").get() as { value: string } | undefined
  )?.value;
  if (kind === "empty") {
    db.prepare("UPDATE app_meta SET value = 'operational' WHERE key = 'data_kind'").run();
  }
}

export function listBoundaries(db: Database.Database): BoundaryVersion[] {
  return (db.prepare("SELECT * FROM boundary_versions ORDER BY effective_from DESC, name").all() as Record<string, unknown>[]).map(
    mapBoundary
  );
}

export function createBoundary(
  db: Database.Database,
  input: {
    name: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    notes?: string;
    status?: BoundaryStatus;
  }
): BoundaryVersion {
  const id = newId();
  db.prepare(
    `INSERT INTO boundary_versions (id, name, effective_from, effective_to, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.name.trim(), input.effectiveFrom, input.effectiveTo ?? null, input.notes ?? "", input.status ?? "active", nowIso());
  writeAudit(db, { action: "create", entityType: "boundary_version", recordId: id, changedFields: ["name", "effectiveFrom", "status"] });
  return mapBoundary(db.prepare("SELECT * FROM boundary_versions WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateBoundary(
  db: Database.Database,
  input: {
    id: string;
    name?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    notes?: string;
    status?: BoundaryStatus;
  }
): BoundaryVersion {
  const current = db.prepare("SELECT * FROM boundary_versions WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Boundary version not found.");
  const fields: string[] = [];
  if (input.name !== undefined) fields.push("name");
  if (input.effectiveFrom !== undefined) fields.push("effective_from");
  if (input.effectiveTo !== undefined) fields.push("effective_to");
  if (input.notes !== undefined) fields.push("notes");
  if (input.status !== undefined) fields.push("status");
  db.prepare(
    `UPDATE boundary_versions SET
      name = COALESCE(?, name),
      effective_from = COALESCE(?, effective_from),
      effective_to = ?,
      notes = COALESCE(?, notes),
      status = COALESCE(?, status)
     WHERE id = ?`
  ).run(
    input.name?.trim() ?? null,
    input.effectiveFrom ?? null,
    input.effectiveTo === undefined ? current.effective_to : input.effectiveTo,
    input.notes ?? null,
    input.status ?? null,
    input.id
  );
  writeAudit(db, { action: "update", entityType: "boundary_version", recordId: input.id, changedFields: fields });
  return mapBoundary(db.prepare("SELECT * FROM boundary_versions WHERE id = ?").get(input.id) as Record<string, unknown>);
}

function insertNamed(
  db: Database.Database,
  table: string,
  extraCols: string[],
  extraVals: unknown[],
  input: { name: string; nameTe?: string; officialCode?: string | null; notes?: string },
  entityType: string,
  isDemo = false
): string {
  if (!input.name.trim()) throw new AppError("validation", "Name is required.");
  const id = newId();
  const ts = nowIso();
  const cols = ["id", "name", "name_te", "official_code", "notes", "archived", "is_demo", "created_at", "updated_at", ...extraCols];
  const placeholders = cols.map(() => "?").join(", ");
  db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(
    id,
    input.name.trim(),
    input.nameTe ?? "",
    official(input.officialCode),
    input.notes ?? "",
    0,
    isDemo ? 1 : 0,
    ts,
    ts,
    ...extraVals
  );
  markOperational(db, isDemo);
  writeAudit(db, { action: "create", entityType, recordId: id, changedFields: ["name", "nameTe", "officialCode"] });
  return id;
}

export function listConstituencies(db: Database.Database, includeArchived = false): AssemblyConstituency[] {
  const sql = includeArchived
    ? "SELECT * FROM assembly_constituencies ORDER BY name"
    : "SELECT * FROM assembly_constituencies WHERE archived = 0 ORDER BY name";
  return (db.prepare(sql).all() as Record<string, unknown>[]).map((row) => mapNamed<AssemblyConstituency>(row));
}

export function createConstituency(
  db: Database.Database,
  input: { name: string; nameTe?: string; officialCode?: string | null; notes?: string },
  isDemo = false
): AssemblyConstituency {
  const id = insertNamed(db, "assembly_constituencies", [], [], input, "assembly_constituency", isDemo);
  return mapNamed(db.prepare("SELECT * FROM assembly_constituencies WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateConstituency(
  db: Database.Database,
  input: { id: string; name?: string; nameTe?: string; officialCode?: string | null; notes?: string; archived?: boolean }
): AssemblyConstituency {
  const current = db.prepare("SELECT * FROM assembly_constituencies WHERE id = ?").get(input.id);
  if (!current) throw new AppError("not_found", "Constituency not found.");
  db.prepare(
    `UPDATE assembly_constituencies SET
      name = COALESCE(?, name),
      name_te = COALESCE(?, name_te),
      official_code = ?,
      notes = COALESCE(?, notes),
      archived = COALESCE(?, archived),
      updated_at = ?
     WHERE id = ?`
  ).run(
    input.name?.trim() ?? null,
    input.nameTe ?? null,
    input.officialCode === undefined ? (current as { official_code: string | null }).official_code : official(input.officialCode),
    input.notes ?? null,
    input.archived === undefined ? null : input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "assembly_constituency", recordId: input.id, changedFields: Object.keys(input).filter((k) => k !== "id") });
  return mapNamed(db.prepare("SELECT * FROM assembly_constituencies WHERE id = ?").get(input.id) as Record<string, unknown>);
}

export function archiveConstituency(db: Database.Database, id: string): void {
  updateConstituency(db, { id, archived: true });
}

export function createMandal(
  db: Database.Database,
  input: { name: string; nameTe?: string; officialCode?: string | null; notes?: string },
  isDemo = false
): Mandal {
  const id = insertNamed(db, "mandals", [], [], input, "mandal", isDemo);
  return mapNamed(db.prepare("SELECT * FROM mandals WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateMandal(
  db: Database.Database,
  input: { id: string; name?: string; nameTe?: string; officialCode?: string | null; notes?: string; archived?: boolean }
): Mandal {
  const current = db.prepare("SELECT * FROM mandals WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Mandal not found.");
  db.prepare(
    `UPDATE mandals SET name = COALESCE(?, name), name_te = COALESCE(?, name_te), official_code = ?, notes = COALESCE(?, notes), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`
  ).run(
    input.name?.trim() ?? null,
    input.nameTe ?? null,
    input.officialCode === undefined ? current.official_code : official(input.officialCode),
    input.notes ?? null,
    input.archived === undefined ? null : input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "mandal", recordId: input.id, changedFields: Object.keys(input).filter((k) => k !== "id") });
  return mapNamed(db.prepare("SELECT * FROM mandals WHERE id = ?").get(input.id) as Record<string, unknown>);
}

export function archiveMandal(db: Database.Database, id: string): void {
  updateMandal(db, { id, archived: true });
}

export function createGp(
  db: Database.Database,
  input: { mandalId: string; name: string; nameTe?: string; officialCode?: string | null; notes?: string },
  isDemo = false
): GramPanchayat {
  const mandal = db.prepare("SELECT id FROM mandals WHERE id = ?").get(input.mandalId);
  if (!mandal) throw new AppError("invalid_parent", "Gram Panchayat must belong to an existing mandal.");
  const id = insertNamed(db, "gram_panchayats", ["mandal_id"], [input.mandalId], input, "gram_panchayat", isDemo);
  return mapGp(db.prepare("SELECT * FROM gram_panchayats WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateGp(
  db: Database.Database,
  input: { id: string; mandalId?: string; name?: string; nameTe?: string; officialCode?: string | null; notes?: string; archived?: boolean }
): GramPanchayat {
  const current = db.prepare("SELECT * FROM gram_panchayats WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Gram Panchayat not found.");
  if (input.mandalId) {
    const mandal = db.prepare("SELECT id FROM mandals WHERE id = ?").get(input.mandalId);
    if (!mandal) throw new AppError("invalid_parent", "Gram Panchayat must belong to an existing mandal.");
  }
  db.prepare(
    `UPDATE gram_panchayats SET mandal_id = COALESCE(?, mandal_id), name = COALESCE(?, name), name_te = COALESCE(?, name_te), official_code = ?, notes = COALESCE(?, notes), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`
  ).run(
    input.mandalId ?? null,
    input.name?.trim() ?? null,
    input.nameTe ?? null,
    input.officialCode === undefined ? current.official_code : official(input.officialCode),
    input.notes ?? null,
    input.archived === undefined ? null : input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "gram_panchayat", recordId: input.id, changedFields: Object.keys(input).filter((k) => k !== "id") });
  return mapGp(db.prepare("SELECT * FROM gram_panchayats WHERE id = ?").get(input.id) as Record<string, unknown>);
}

export function archiveGp(db: Database.Database, id: string): void {
  updateGp(db, { id, archived: true });
}

export function createVillage(
  db: Database.Database,
  input: { gramPanchayatId: string; name: string; nameTe?: string; officialCode?: string | null; notes?: string },
  isDemo = false
): Village {
  const gp = db.prepare("SELECT id FROM gram_panchayats WHERE id = ?").get(input.gramPanchayatId);
  if (!gp) throw new AppError("invalid_parent", "Village must belong to an existing Gram Panchayat.");
  const id = insertNamed(db, "villages", ["gram_panchayat_id"], [input.gramPanchayatId], input, "village", isDemo);
  return mapVillage(db.prepare("SELECT * FROM villages WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateVillage(
  db: Database.Database,
  input: { id: string; gramPanchayatId?: string; name?: string; nameTe?: string; officialCode?: string | null; notes?: string; archived?: boolean }
): Village {
  const current = db.prepare("SELECT * FROM villages WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Village not found.");
  if (input.gramPanchayatId) {
    const gp = db.prepare("SELECT id FROM gram_panchayats WHERE id = ?").get(input.gramPanchayatId);
    if (!gp) throw new AppError("invalid_parent", "Village must belong to an existing Gram Panchayat.");
  }
  db.prepare(
    `UPDATE villages SET gram_panchayat_id = COALESCE(?, gram_panchayat_id), name = COALESCE(?, name), name_te = COALESCE(?, name_te), official_code = ?, notes = COALESCE(?, notes), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`
  ).run(
    input.gramPanchayatId ?? null,
    input.name?.trim() ?? null,
    input.nameTe ?? null,
    input.officialCode === undefined ? current.official_code : official(input.officialCode),
    input.notes ?? null,
    input.archived === undefined ? null : input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "village", recordId: input.id, changedFields: Object.keys(input).filter((k) => k !== "id") });
  return mapVillage(db.prepare("SELECT * FROM villages WHERE id = ?").get(input.id) as Record<string, unknown>);
}

export function archiveVillage(db: Database.Database, id: string): void {
  updateVillage(db, { id, archived: true });
}

export function createUlb(
  db: Database.Database,
  input: {
    bodyType: UrbanBodyType;
    name: string;
    nameTe?: string;
    officialCode?: string | null;
    notes?: string;
    administrativeMandalId?: string | null;
  },
  isDemo = false
): UrbanLocalBody {
  if (input.administrativeMandalId) {
    const mandal = db.prepare("SELECT id FROM mandals WHERE id = ?").get(input.administrativeMandalId);
    if (!mandal) throw new AppError("invalid_parent", "Urban local body administrative mandal was not found.");
  }
  const id = insertNamed(
    db,
    "urban_local_bodies",
    ["body_type", "administrative_mandal_id"],
    [input.bodyType, input.administrativeMandalId ?? null],
    input,
    "urban_local_body",
    isDemo
  );
  return mapUlb(db.prepare("SELECT * FROM urban_local_bodies WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateUlb(
  db: Database.Database,
  input: {
    id: string;
    bodyType?: UrbanBodyType;
    name?: string;
    nameTe?: string;
    officialCode?: string | null;
    notes?: string;
    administrativeMandalId?: string | null;
    archived?: boolean;
  }
): UrbanLocalBody {
  const current = db.prepare("SELECT * FROM urban_local_bodies WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Urban local body not found.");
  if (input.administrativeMandalId) {
    const mandal = db.prepare("SELECT id FROM mandals WHERE id = ?").get(input.administrativeMandalId);
    if (!mandal) throw new AppError("invalid_parent", "Urban local body administrative mandal was not found.");
  }
  const mandalValue =
    input.administrativeMandalId === undefined ? current.administrative_mandal_id : input.administrativeMandalId;
  db.prepare(
    `UPDATE urban_local_bodies SET body_type = COALESCE(?, body_type), name = COALESCE(?, name), name_te = COALESCE(?, name_te), official_code = ?, administrative_mandal_id = ?, notes = COALESCE(?, notes), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`
  ).run(
    input.bodyType ?? null,
    input.name?.trim() ?? null,
    input.nameTe ?? null,
    input.officialCode === undefined ? current.official_code : official(input.officialCode),
    mandalValue,
    input.notes ?? null,
    input.archived === undefined ? null : input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "urban_local_body", recordId: input.id, changedFields: Object.keys(input).filter((k) => k !== "id") });
  return mapUlb(db.prepare("SELECT * FROM urban_local_bodies WHERE id = ?").get(input.id) as Record<string, unknown>);
}

export function archiveUlb(db: Database.Database, id: string): void {
  updateUlb(db, { id, archived: true });
}

export function listMandals(
  db: Database.Database,
  input?: { constituencyId?: string; boundaryVersionId?: string; includeArchived?: boolean }
): Mandal[] {
  const rows = db
    .prepare(`SELECT * FROM mandals ${input?.includeArchived ? "" : "WHERE archived = 0 "} ORDER BY name`)
    .all() as Record<string, unknown>[];
  let items = rows.map((row) => mapNamed<Mandal>(row));
  if (input?.constituencyId && input.boundaryVersionId) {
    const scope = resolveScope(db, input.constituencyId, input.boundaryVersionId);
    items = items.filter((item) => scope.mandals[item.id]);
  }
  return items;
}

export function listGps(
  db: Database.Database,
  input?: { mandalId?: string; constituencyId?: string; boundaryVersionId?: string; includeArchived?: boolean }
): GramPanchayat[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!input?.includeArchived) clauses.push("archived = 0");
  if (input?.mandalId) {
    clauses.push("mandal_id = ?");
    params.push(input.mandalId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  let items = (db.prepare(`SELECT * FROM gram_panchayats ${where} ORDER BY name`).all(...params) as Record<string, unknown>[]).map(mapGp);
  if (input?.constituencyId && input.boundaryVersionId) {
    const scope = resolveScope(db, input.constituencyId, input.boundaryVersionId);
    items = items.filter((item) => scope.gramPanchayats[item.id]);
  }
  return items;
}

export function listVillages(
  db: Database.Database,
  input?: { gramPanchayatId?: string; constituencyId?: string; boundaryVersionId?: string; includeArchived?: boolean }
): Village[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!input?.includeArchived) clauses.push("archived = 0");
  if (input?.gramPanchayatId) {
    clauses.push("gram_panchayat_id = ?");
    params.push(input.gramPanchayatId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  let items = (db.prepare(`SELECT * FROM villages ${where} ORDER BY name`).all(...params) as Record<string, unknown>[]).map(mapVillage);
  if (input?.constituencyId && input.boundaryVersionId) {
    const scope = resolveScope(db, input.constituencyId, input.boundaryVersionId);
    items = items.filter((item) => scope.villages[item.id]);
  }
  return items;
}

export function listUlbs(
  db: Database.Database,
  input?: { constituencyId?: string; boundaryVersionId?: string; includeArchived?: boolean }
): UrbanLocalBody[] {
  const rows = db
    .prepare(`SELECT * FROM urban_local_bodies ${input?.includeArchived ? "" : "WHERE archived = 0 "} ORDER BY name`)
    .all() as Record<string, unknown>[];
  let items = rows.map(mapUlb);
  if (input?.constituencyId && input.boundaryVersionId) {
    const scope = resolveScope(db, input.constituencyId, input.boundaryVersionId);
    items = items.filter((item) => scope.urbanLocalBodies[item.id]);
  }
  return items;
}

export function tryDeleteEntity(db: Database.Database, table: string, id: string, entityType: string): void {
  try {
    const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    if (info.changes === 0) throw new AppError("not_found", "Record not found.");
    writeAudit(db, { action: "delete", entityType, recordId: id, changedFields: [] });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "has_dependents",
      "This record cannot be deleted because other records depend on it. Archive it to preserve history."
    );
  }
}
