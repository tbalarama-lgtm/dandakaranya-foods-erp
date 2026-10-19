import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import ExcelJS from "exceljs";
import {
  ORG_APPOINTMENT_STATUSES,
  ORG_GEO_TYPES,
  ORG_IMPORT_KINDS,
  ORG_UNIT_KINDS,
  ORG_UNIT_LEVELS,
  VERIFICATION_STATUSES
} from "@shared/constants";
import { isIsoDate, localDateString } from "@shared/dates";
import type {
  OrgExportInput,
  OrgGeoAssociation,
  OrgGeoType,
  OrgImportCommitResult,
  OrgImportKind,
  OrgImportPreviewRow,
  OrgImportSession,
  OrgOverview,
  OrgPostCapacity,
  OrgReportingNode,
  OrgUnitKind,
  OrgUnitLevel,
  Organization,
  OrganizationAppointment,
  OrganizationAppointmentHistory,
  OrganizationPost,
  OrganizationUnit,
  OrganizationUnitGeo,
  OrganizationWing,
  VerificationStatus
} from "@shared/types";
import { newId, nowIso } from "../db/ids";
import { AppError } from "../errors";
import { writeAudit } from "./audit";
import { parseCsv, stringifyCsv, guardSpreadsheetCell } from "./csv";
import { createPerson } from "./workspace";

const COVERING = new Set(["scheduled", "active"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const UNIT_FIELDS = [
  "name",
  "unit_kind",
  "level",
  "wing_name",
  "parent_unit_id",
  "source_reference",
  "verification_status",
  "geo_type",
  "geo_id"
] as const;
const POST_FIELDS = [
  "unit_id",
  "title",
  "wing_name",
  "authorized_positions",
  "parent_post_id",
  "source_reference",
  "verification_status"
] as const;
const APPT_FIELDS = [
  "post_id",
  "office_holder_name",
  "membership_reference",
  "appointment_reference",
  "appointment_date",
  "start_date",
  "end_date",
  "status",
  "consent_source",
  "verification_status",
  "verification_notes"
] as const;

interface OrgImportState {
  session: OrgImportSession;
  filePath: string;
  fingerprint: string;
  rows: string[][];
  headers: string[];
}

const sessions = new Map<string, OrgImportState>();

export function orgTemplateFields(kind: OrgImportKind): readonly string[] {
  if (kind === "units") return UNIT_FIELDS;
  if (kind === "posts") return POST_FIELDS;
  return APPT_FIELDS;
}

function bool(value: number | unknown): boolean {
  return Number(value) === 1;
}

function asVerification(value: string): VerificationStatus {
  if ((VERIFICATION_STATUSES as readonly string[]).includes(value)) return value as VerificationStatus;
  throw new AppError("validation", "Verification status must be unverified, verified, or needs_review.");
}

function asKind(value: string): OrgUnitKind {
  if ((ORG_UNIT_KINDS as readonly string[]).includes(value)) return value as OrgUnitKind;
  throw new AppError("validation", "Unit kind must be committee or unit.");
}

function asLevel(value: string): OrgUnitLevel {
  if ((ORG_UNIT_LEVELS as readonly string[]).includes(value)) return value as OrgUnitLevel;
  throw new AppError("validation", "Unit level is not a supported organizational level.");
}

function asGeoType(value: string): OrgGeoType {
  if ((ORG_GEO_TYPES as readonly string[]).includes(value)) return value as OrgGeoType;
  throw new AppError("validation", "Geographic association type is not supported.");
}

function asApptStatus(value: string): OrganizationAppointment["status"] {
  if ((ORG_APPOINTMENT_STATUSES as readonly string[]).includes(value)) {
    return value as OrganizationAppointment["status"];
  }
  throw new AppError("validation", "Appointment status is not supported.");
}

function requireIso(value: string | null | undefined, label: string, required: boolean): string | null {
  const text = value?.trim() ?? "";
  if (!text) {
    if (required) throw new AppError("validation", `${label} is required.`);
    return null;
  }
  if (!isIsoDate(text) && !DATE.test(text)) throw new AppError("validation", `${label} must be YYYY-MM-DD.`);
  return text;
}

function mapOrg(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    nameTe: String(row.name_te ?? ""),
    notes: String(row.notes ?? ""),
    sourceReference: String(row.source_reference ?? ""),
    verificationStatus: row.verification_status as VerificationStatus,
    archived: bool(row.archived),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapWing(row: Record<string, unknown>): OrganizationWing {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    notes: String(row.notes ?? ""),
    archived: bool(row.archived),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapGeo(row: Record<string, unknown>): OrganizationUnitGeo {
  return {
    id: String(row.id),
    unitId: String(row.unit_id),
    geoType: row.geo_type as OrgGeoType,
    geoId: String(row.geo_id),
    notes: String(row.notes ?? "")
  };
}

function geoForUnits(db: Database.Database, unitIds: string[]): Map<string, OrganizationUnitGeo[]> {
  const map = new Map<string, OrganizationUnitGeo[]>();
  if (!unitIds.length) return map;
  const rows = db
    .prepare(`SELECT * FROM organization_unit_geo WHERE unit_id IN (${unitIds.map(() => "?").join(",")})`)
    .all(...unitIds) as Record<string, unknown>[];
  for (const row of rows) {
    const item = mapGeo(row);
    const list = map.get(item.unitId) ?? [];
    list.push(item);
    map.set(item.unitId, list);
  }
  return map;
}

function mapUnit(row: Record<string, unknown>, geo: OrganizationUnitGeo[]): OrganizationUnit {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    wingId: row.wing_id ? String(row.wing_id) : null,
    parentUnitId: row.parent_unit_id ? String(row.parent_unit_id) : null,
    name: String(row.name),
    unitKind: row.unit_kind as OrgUnitKind,
    level: row.level as OrgUnitLevel,
    sourceReference: String(row.source_reference ?? ""),
    verificationStatus: row.verification_status as VerificationStatus,
    archived: bool(row.archived),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    wingName: row.wing_name ? String(row.wing_name) : null,
    parentName: row.parent_name ? String(row.parent_name) : null,
    geo
  };
}

function mapPost(row: Record<string, unknown>): OrganizationPost {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    unitId: String(row.unit_id),
    wingId: row.wing_id ? String(row.wing_id) : null,
    title: String(row.title),
    authorizedPositions:
      row.authorized_positions == null || row.authorized_positions === ""
        ? null
        : Number(row.authorized_positions),
    parentPostId: row.parent_post_id ? String(row.parent_post_id) : null,
    sourceReference: String(row.source_reference ?? ""),
    verificationStatus: row.verification_status as VerificationStatus,
    archived: bool(row.archived),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    unitName: row.unit_name ? String(row.unit_name) : undefined,
    wingName: row.wing_name ? String(row.wing_name) : null,
    parentTitle: row.parent_title ? String(row.parent_title) : null
  };
}

function mapAppointment(row: Record<string, unknown>): OrganizationAppointment {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    personId: String(row.person_id),
    officeHolderName: String(row.office_holder_name ?? row.name ?? ""),
    membershipReference: String(row.membership_reference ?? ""),
    appointmentReference: String(row.appointment_reference ?? ""),
    appointmentDate: row.appointment_date ? String(row.appointment_date) : null,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    status: row.status as OrganizationAppointment["status"],
    consentSource: String(row.consent_source ?? ""),
    verificationStatus: row.verification_status as VerificationStatus,
    verificationNotes: String(row.verification_notes ?? ""),
    sourceFilename: String(row.source_filename ?? ""),
    sourceRow: row.source_row == null ? null : Number(row.source_row),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    postTitle: row.post_title ? String(row.post_title) : undefined,
    unitName: row.unit_name ? String(row.unit_name) : undefined
  };
}

export function getOrganization(db: Database.Database, id: string): Organization {
  const row = db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Organization not found.");
  return mapOrg(row);
}

export function listOrganizations(db: Database.Database, includeArchived = false): Organization[] {
  const sql = includeArchived
    ? "SELECT * FROM organizations ORDER BY name"
    : "SELECT * FROM organizations WHERE archived = 0 ORDER BY name";
  return (db.prepare(sql).all() as Record<string, unknown>[]).map(mapOrg);
}

export function createOrganization(
  db: Database.Database,
  input: { name: string; nameTe?: string; notes?: string; sourceReference?: string; verificationStatus?: VerificationStatus }
): Organization {
  const name = input.name.trim();
  if (!name) throw new AppError("validation", "Organization name is required.");
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO organizations (id, name, name_te, notes, source_reference, verification_status, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    name,
    input.nameTe?.trim() ?? "",
    input.notes?.trim() ?? "",
    input.sourceReference?.trim() ?? "",
    input.verificationStatus ?? "unverified",
    ts,
    ts
  );
  writeAudit(db, { action: "create", entityType: "organization", recordId: id, changedFields: ["name"] });
  return getOrganization(db, id);
}

export function updateOrganization(
  db: Database.Database,
  input: {
    id: string;
    name: string;
    nameTe?: string;
    notes?: string;
    sourceReference?: string;
    verificationStatus?: VerificationStatus;
    archived?: boolean;
  }
): Organization {
  getOrganization(db, input.id);
  const name = input.name.trim();
  if (!name) throw new AppError("validation", "Organization name is required.");
  db.prepare(
    `UPDATE organizations SET name = ?, name_te = ?, notes = ?, source_reference = ?, verification_status = ?, archived = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    name,
    input.nameTe?.trim() ?? "",
    input.notes?.trim() ?? "",
    input.sourceReference?.trim() ?? "",
    input.verificationStatus ?? "unverified",
    input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "organization", recordId: input.id, changedFields: ["name"] });
  return getOrganization(db, input.id);
}

export function archiveOrganization(db: Database.Database, id: string): void {
  getOrganization(db, id);
  db.prepare("UPDATE organizations SET archived = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
  writeAudit(db, { action: "archive", entityType: "organization", recordId: id, changedFields: ["archived"] });
}

export function listWings(db: Database.Database, organizationId: string): OrganizationWing[] {
  getOrganization(db, organizationId);
  return (db
    .prepare("SELECT * FROM organization_wings WHERE organization_id = ? AND archived = 0 ORDER BY name")
    .all(organizationId) as Record<string, unknown>[]).map(mapWing);
}

export function createWing(
  db: Database.Database,
  input: { organizationId: string; name: string; notes?: string }
): OrganizationWing {
  getOrganization(db, input.organizationId);
  const name = input.name.trim();
  if (!name) throw new AppError("validation", "Wing or committee name is required.");
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO organization_wings (id, organization_id, name, notes, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  ).run(id, input.organizationId, name, input.notes?.trim() ?? "", ts, ts);
  writeAudit(db, { action: "create", entityType: "organization_wing", recordId: id, changedFields: ["name"] });
  return mapWing(db.prepare("SELECT * FROM organization_wings WHERE id = ?").get(id) as Record<string, unknown>);
}

function walkParent<T extends { parent: string | null }>(
  startId: string | null,
  load: (id: string) => T | undefined
): boolean {
  const seen = new Set<string>();
  let current = startId;
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = load(current)?.parent ?? null;
  }
  return false;
}

export function createUnit(
  db: Database.Database,
  input: {
    organizationId: string;
    name: string;
    unitKind: OrgUnitKind;
    level: OrgUnitLevel;
    wingId?: string | null;
    parentUnitId?: string | null;
    sourceReference?: string;
    verificationStatus?: VerificationStatus;
    geo?: Array<{ geoType: OrgGeoType; geoId: string; notes?: string }>;
  }
): OrganizationUnit {
  getOrganization(db, input.organizationId);
  const name = input.name.trim();
  if (!name) throw new AppError("validation", "Unit name is required.");
  asKind(input.unitKind);
  asLevel(input.level);
  if (input.parentUnitId) {
    const parent = getUnit(db, input.parentUnitId);
    if (parent.organizationId !== input.organizationId) {
      throw new AppError("validation", "Parent unit must belong to the same organization.");
    }
    if (
      walkParent(input.parentUnitId, (id) => {
        const row = db.prepare("SELECT parent_unit_id AS parent FROM organization_units WHERE id = ?").get(id) as
          | { parent: string | null }
          | undefined;
        return row;
      })
    ) {
      throw new AppError("validation", "Unit parent would create a circular hierarchy.");
    }
  }
  const id = newId();
  const ts = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO organization_units (
        id, organization_id, wing_id, parent_unit_id, name, unit_kind, level, source_reference, verification_status, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      id,
      input.organizationId,
      input.wingId ?? null,
      input.parentUnitId ?? null,
      name,
      input.unitKind,
      input.level,
      input.sourceReference?.trim() ?? "",
      input.verificationStatus ?? "unverified",
      ts,
      ts
    );
    for (const link of input.geo ?? []) {
      insertGeo(db, id, link.geoType, link.geoId, link.notes ?? "");
    }
    writeAudit(db, { action: "create", entityType: "organization_unit", recordId: id, changedFields: ["name", "level"] });
  })();
  return getUnit(db, id);
}

function insertGeo(db: Database.Database, unitId: string, geoType: OrgGeoType, geoId: string, notes: string): void {
  asGeoType(geoType);
  if (!geoId.trim()) throw new AppError("validation", "Geographic association requires an identifier.");
  db.prepare(
    `INSERT INTO organization_unit_geo (id, unit_id, geo_type, geo_id, notes) VALUES (?, ?, ?, ?, ?)`
  ).run(newId(), unitId, geoType, geoId.trim(), notes.trim());
}

export function getUnit(db: Database.Database, id: string): OrganizationUnit {
  const row = db
    .prepare(
      `SELECT u.*, w.name AS wing_name, p.name AS parent_name
       FROM organization_units u
       LEFT JOIN organization_wings w ON w.id = u.wing_id
       LEFT JOIN organization_units p ON p.id = u.parent_unit_id
       WHERE u.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Organization unit not found.");
  return mapUnit(row, geoForUnits(db, [id]).get(id) ?? []);
}

export function listUnits(
  db: Database.Database,
  input: { organizationId: string; includeArchived?: boolean }
): OrganizationUnit[] {
  getOrganization(db, input.organizationId);
  const rows = db
    .prepare(
      `SELECT u.*, w.name AS wing_name, p.name AS parent_name
       FROM organization_units u
       LEFT JOIN organization_wings w ON w.id = u.wing_id
       LEFT JOIN organization_units p ON p.id = u.parent_unit_id
       WHERE u.organization_id = ? ${input.includeArchived ? "" : "AND u.archived = 0"}
       ORDER BY u.level, u.name`
    )
    .all(input.organizationId) as Record<string, unknown>[];
  const geo = geoForUnits(
    db,
    rows.map((row) => String(row.id))
  );
  return rows.map((row) => mapUnit(row, geo.get(String(row.id)) ?? []));
}

export function updateUnit(
  db: Database.Database,
  input: {
    id: string;
    name: string;
    unitKind: OrgUnitKind;
    level: OrgUnitLevel;
    wingId?: string | null;
    parentUnitId?: string | null;
    sourceReference?: string;
    verificationStatus?: VerificationStatus;
    archived?: boolean;
  }
): OrganizationUnit {
  const existing = getUnit(db, input.id);
  if (input.parentUnitId === input.id) throw new AppError("validation", "A unit cannot report to itself.");
  if (input.parentUnitId) {
    const parent = getUnit(db, input.parentUnitId);
    if (parent.organizationId !== existing.organizationId) {
      throw new AppError("validation", "Parent unit must belong to the same organization.");
    }
    let current: string | null = input.parentUnitId;
    const seen = new Set<string>([input.id]);
    while (current) {
      if (seen.has(current)) throw new AppError("validation", "Unit parent would create a circular hierarchy.");
      seen.add(current);
      const row = db.prepare("SELECT parent_unit_id FROM organization_units WHERE id = ?").get(current) as
        | { parent_unit_id: string | null }
        | undefined;
      current = row?.parent_unit_id ?? null;
    }
  }
  db.prepare(
    `UPDATE organization_units
     SET name = ?, unit_kind = ?, level = ?, wing_id = ?, parent_unit_id = ?, source_reference = ?, verification_status = ?, archived = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.name.trim(),
    asKind(input.unitKind),
    asLevel(input.level),
    input.wingId ?? null,
    input.parentUnitId ?? null,
    input.sourceReference?.trim() ?? "",
    input.verificationStatus ?? existing.verificationStatus,
    input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "organization_unit", recordId: input.id, changedFields: ["name"] });
  return getUnit(db, input.id);
}

export function setUnitGeo(
  db: Database.Database,
  input: { unitId: string; links: Array<{ geoType: OrgGeoType; geoId: string; notes?: string }> }
): OrganizationUnit {
  getUnit(db, input.unitId);
  db.transaction(() => {
    db.prepare("DELETE FROM organization_unit_geo WHERE unit_id = ?").run(input.unitId);
    for (const link of input.links) insertGeo(db, input.unitId, link.geoType, link.geoId, link.notes ?? "");
    writeAudit(db, { action: "update", entityType: "organization_unit", recordId: input.unitId, changedFields: ["geo"] });
  })();
  return getUnit(db, input.unitId);
}

export function getPost(db: Database.Database, id: string): OrganizationPost {
  const row = db
    .prepare(
      `SELECT p.*, u.name AS unit_name, w.name AS wing_name, parent.title AS parent_title
       FROM organization_posts p
       JOIN organization_units u ON u.id = p.unit_id
       LEFT JOIN organization_wings w ON w.id = p.wing_id
       LEFT JOIN organization_posts parent ON parent.id = p.parent_post_id
       WHERE p.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Organization post not found.");
  return mapPost(row);
}

export function listPosts(
  db: Database.Database,
  input: { organizationId: string; unitId?: string; includeArchived?: boolean }
): OrganizationPost[] {
  getOrganization(db, input.organizationId);
  const clauses = ["p.organization_id = ?"];
  const params: unknown[] = [input.organizationId];
  if (input.unitId) {
    clauses.push("p.unit_id = ?");
    params.push(input.unitId);
  }
  if (!input.includeArchived) clauses.push("p.archived = 0");
  return (
    db
      .prepare(
        `SELECT p.*, u.name AS unit_name, w.name AS wing_name, parent.title AS parent_title
         FROM organization_posts p
         JOIN organization_units u ON u.id = p.unit_id
         LEFT JOIN organization_wings w ON w.id = p.wing_id
         LEFT JOIN organization_posts parent ON parent.id = p.parent_post_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY u.name, p.title`
      )
      .all(...params) as Record<string, unknown>[]
  ).map(mapPost);
}

function assertPostParent(db: Database.Database, postId: string | null, parentPostId: string | null, organizationId: string): void {
  if (!parentPostId) return;
  if (postId && parentPostId === postId) throw new AppError("validation", "A post cannot report to itself.");
  const parent = getPost(db, parentPostId);
  if (parent.organizationId !== organizationId) {
    throw new AppError("validation", "Reporting post must belong to the same organization.");
  }
  let current: string | null = parentPostId;
  const seen = new Set<string>(postId ? [postId] : []);
  while (current) {
    if (seen.has(current)) throw new AppError("validation", "Reporting relationship would create a cycle.");
    seen.add(current);
    const row = db.prepare("SELECT parent_post_id FROM organization_posts WHERE id = ?").get(current) as
      | { parent_post_id: string | null }
      | undefined;
    current = row?.parent_post_id ?? null;
  }
}

export function createPost(
  db: Database.Database,
  input: {
    organizationId: string;
    unitId: string;
    title: string;
    wingId?: string | null;
    authorizedPositions?: number | null;
    parentPostId?: string | null;
    sourceReference?: string;
    verificationStatus?: VerificationStatus;
  }
): OrganizationPost {
  getOrganization(db, input.organizationId);
  const unit = getUnit(db, input.unitId);
  if (unit.organizationId !== input.organizationId) {
    throw new AppError("validation", "Post unit must belong to the same organization.");
  }
  const title = input.title.trim();
  if (!title) throw new AppError("validation", "Post title is required. Do not invent official titles.");
  if (input.authorizedPositions != null && input.authorizedPositions < 0) {
    throw new AppError("validation", "Authorized positions cannot be negative.");
  }
  assertPostParent(db, null, input.parentPostId ?? null, input.organizationId);
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO organization_posts (
      id, organization_id, unit_id, wing_id, title, authorized_positions, parent_post_id, source_reference, verification_status, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.organizationId,
    input.unitId,
    input.wingId ?? null,
    title,
    input.authorizedPositions ?? null,
    input.parentPostId ?? null,
    input.sourceReference?.trim() ?? "",
    input.verificationStatus ?? "unverified",
    ts,
    ts
  );
  writeAudit(db, { action: "create", entityType: "organization_post", recordId: id, changedFields: ["title"] });
  return getPost(db, id);
}

export function updatePost(
  db: Database.Database,
  input: {
    id: string;
    title: string;
    unitId: string;
    wingId?: string | null;
    authorizedPositions?: number | null;
    parentPostId?: string | null;
    sourceReference?: string;
    verificationStatus?: VerificationStatus;
    archived?: boolean;
  }
): OrganizationPost {
  const existing = getPost(db, input.id);
  const title = input.title.trim();
  if (!title) throw new AppError("validation", "Post title is required.");
  assertPostParent(db, input.id, input.parentPostId ?? null, existing.organizationId);
  db.prepare(
    `UPDATE organization_posts
     SET title = ?, unit_id = ?, wing_id = ?, authorized_positions = ?, parent_post_id = ?, source_reference = ?, verification_status = ?, archived = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    title,
    input.unitId,
    input.wingId ?? null,
    input.authorizedPositions ?? null,
    input.parentPostId ?? null,
    input.sourceReference?.trim() ?? "",
    input.verificationStatus ?? existing.verificationStatus,
    input.archived ? 1 : 0,
    nowIso(),
    input.id
  );
  writeAudit(db, { action: "update", entityType: "organization_post", recordId: input.id, changedFields: ["title"] });
  return getPost(db, input.id);
}

export function reportingTree(db: Database.Database, organizationId: string): OrgReportingNode[] {
  const posts = listPosts(db, { organizationId });
  const byParent = new Map<string | null, OrganizationPost[]>();
  for (const post of posts) {
    const key = post.parentPostId;
    const list = byParent.get(key) ?? [];
    list.push(post);
    byParent.set(key, list);
  }
  const build = (parentId: string | null, stack: Set<string>): OrgReportingNode[] => {
    return (byParent.get(parentId) ?? []).map((post) => {
      if (stack.has(post.id)) {
        return { post, children: [] };
      }
      const next = new Set(stack);
      next.add(post.id);
      return { post, children: build(post.id, next) };
    });
  };
  return build(null, new Set());
}

function rangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null
): boolean {
  const aUntil = aEnd ?? "9999-12-31";
  const bUntil = bEnd ?? "9999-12-31";
  return aStart <= bUntil && bStart <= aUntil;
}

export function overlappingAppointments(
  db: Database.Database,
  postId: string,
  startDate: string,
  endDate: string | null,
  ignoreId?: string
): OrganizationAppointment[] {
  const rows = db
    .prepare(
      `SELECT a.*, p.name AS office_holder_name
       FROM organization_appointments a
       JOIN persons p ON p.id = a.person_id
       WHERE a.post_id = ? AND a.status IN ('scheduled','active')`
    )
    .all(postId) as Record<string, unknown>[];
  return rows
    .map(mapAppointment)
    .filter((item) => item.id !== ignoreId && rangesOverlap(startDate, endDate, item.startDate, item.endDate));
}

function writeApptHistory(
  db: Database.Database,
  appointmentId: string,
  action: string,
  notes: string,
  fieldNames: string[]
): void {
  db.prepare(
    `INSERT INTO organization_appointment_history (id, appointment_id, changed_at, action, notes, field_names)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(newId(), appointmentId, nowIso(), action, notes, JSON.stringify(fieldNames));
}

export function createAppointment(
  db: Database.Database,
  input: {
    postId: string;
    officeHolderName: string;
    personId?: string;
    membershipReference?: string;
    appointmentReference?: string;
    appointmentDate?: string | null;
    startDate: string;
    endDate?: string | null;
    status: OrganizationAppointment["status"];
    consentSource?: string;
    verificationStatus?: VerificationStatus;
    verificationNotes?: string;
    sourceFilename?: string;
    sourceRow?: number | null;
    allowOverlap?: boolean;
  }
): OrganizationAppointment {
  getPost(db, input.postId);
  const name = input.officeHolderName.trim();
  if (!name) throw new AppError("validation", "Office-holder name is required.");
  const start = requireIso(input.startDate, "Start date", true)!;
  const end = requireIso(input.endDate ?? null, "End date", false);
  if (end && end < start) throw new AppError("validation", "End date cannot precede start date.");
  asApptStatus(input.status);
  const overlaps = COVERING.has(input.status) ? overlappingAppointments(db, input.postId, start, end) : [];
  if (overlaps.length && !input.allowOverlap) {
    throw new AppError(
      "overlap",
      `This appointment overlaps ${overlaps.length} existing covering appointment(s). Confirm to record both without merging.`
    );
  }
  const personId =
    input.personId ??
    createPerson(db, {
      name,
      consentStatus: "unknown",
      consentSource: input.consentSource?.trim() || "organizational appointment (name only; no voter link)"
    }).id;
  const id = newId();
  const ts = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO organization_appointments (
        id, post_id, person_id, membership_reference, appointment_reference, appointment_date, start_date, end_date,
        status, consent_source, verification_status, verification_notes, source_filename, source_row, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.postId,
      personId,
      input.membershipReference?.trim() ?? "",
      input.appointmentReference?.trim() ?? "",
      requireIso(input.appointmentDate ?? null, "Appointment date", false),
      start,
      end,
      input.status,
      input.consentSource?.trim() ?? "",
      input.verificationStatus ?? "unverified",
      input.verificationNotes?.trim() ?? "",
      input.sourceFilename?.trim() ?? "",
      input.sourceRow ?? null,
      ts,
      ts
    );
    writeApptHistory(db, id, "create", overlaps.length ? "Recorded with overlapping covering appointment(s)." : "", [
      "status",
      "startDate"
    ]);
    writeAudit(db, { action: "create", entityType: "organization_appointment", recordId: id, changedFields: ["postId", "status"] });
  })();
  return getAppointment(db, id);
}

export function getAppointment(db: Database.Database, id: string): OrganizationAppointment {
  const row = db
    .prepare(
      `SELECT a.*, p.name AS office_holder_name, op.title AS post_title, u.name AS unit_name
       FROM organization_appointments a
       JOIN persons p ON p.id = a.person_id
       JOIN organization_posts op ON op.id = a.post_id
       JOIN organization_units u ON u.id = op.unit_id
       WHERE a.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Organization appointment not found.");
  return mapAppointment(row);
}

export function listAppointments(
  db: Database.Database,
  input: {
    organizationId: string;
    postId?: string;
    coveringOnly?: boolean;
    includeEnded?: boolean;
  }
): OrganizationAppointment[] {
  getOrganization(db, input.organizationId);
  const clauses = ["op.organization_id = ?"];
  const params: unknown[] = [input.organizationId];
  if (input.postId) {
    clauses.push("a.post_id = ?");
    params.push(input.postId);
  }
  if (input.coveringOnly) clauses.push("a.status IN ('scheduled','active')");
  else if (!input.includeEnded) clauses.push("a.status IN ('scheduled','active')");
  return (
    db
      .prepare(
        `SELECT a.*, p.name AS office_holder_name, op.title AS post_title, u.name AS unit_name
         FROM organization_appointments a
         JOIN persons p ON p.id = a.person_id
         JOIN organization_posts op ON op.id = a.post_id
         JOIN organization_units u ON u.id = op.unit_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY a.start_date DESC, p.name`
      )
      .all(...params) as Record<string, unknown>[]
  ).map(mapAppointment);
}

export function updateAppointment(
  db: Database.Database,
  input: {
    id: string;
    membershipReference?: string;
    appointmentReference?: string;
    appointmentDate?: string | null;
    startDate: string;
    endDate?: string | null;
    status: OrganizationAppointment["status"];
    consentSource?: string;
    verificationStatus?: VerificationStatus;
    verificationNotes?: string;
    allowOverlap?: boolean;
  }
): OrganizationAppointment {
  const existing = getAppointment(db, input.id);
  const start = requireIso(input.startDate, "Start date", true)!;
  const end = requireIso(input.endDate ?? null, "End date", false);
  if (end && end < start) throw new AppError("validation", "End date cannot precede start date.");
  asApptStatus(input.status);
  const overlaps = COVERING.has(input.status)
    ? overlappingAppointments(db, existing.postId, start, end, input.id)
    : [];
  if (overlaps.length && !input.allowOverlap) {
    throw new AppError(
      "overlap",
      `This appointment overlaps ${overlaps.length} existing covering appointment(s). Confirm to keep both.`
    );
  }
  db.transaction(() => {
    db.prepare(
      `UPDATE organization_appointments
       SET membership_reference = ?, appointment_reference = ?, appointment_date = ?, start_date = ?, end_date = ?,
           status = ?, consent_source = ?, verification_status = ?, verification_notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.membershipReference?.trim() ?? existing.membershipReference,
      input.appointmentReference?.trim() ?? existing.appointmentReference,
      requireIso(input.appointmentDate ?? existing.appointmentDate, "Appointment date", false),
      start,
      end,
      input.status,
      input.consentSource?.trim() ?? existing.consentSource,
      input.verificationStatus ?? existing.verificationStatus,
      input.verificationNotes?.trim() ?? existing.verificationNotes,
      nowIso(),
      input.id
    );
    writeApptHistory(db, input.id, "update", `Status ${existing.status} → ${input.status}.`, ["status", "startDate", "endDate"]);
    writeAudit(db, { action: "update", entityType: "organization_appointment", recordId: input.id, changedFields: ["status"] });
  })();
  return getAppointment(db, input.id);
}

export function appointmentHistory(db: Database.Database, appointmentId: string): OrganizationAppointmentHistory[] {
  getAppointment(db, appointmentId);
  return (
    db
      .prepare("SELECT * FROM organization_appointment_history WHERE appointment_id = ? ORDER BY changed_at, id")
      .all(appointmentId) as Record<string, unknown>[]
  ).map((row) => ({
    id: String(row.id),
    appointmentId: String(row.appointment_id),
    changedAt: String(row.changed_at),
    action: String(row.action),
    notes: String(row.notes ?? ""),
    fieldNames: JSON.parse(String(row.field_names || "[]")) as string[]
  }));
}

export function listAppointmentHistory(
  db: Database.Database,
  organizationId: string
): Array<OrganizationAppointmentHistory & { officeHolderName: string; postTitle: string }> {
  getOrganization(db, organizationId);
  return (
    db
      .prepare(
        `SELECT h.*, p.name AS office_holder_name, op.title AS post_title
         FROM organization_appointment_history h
         JOIN organization_appointments a ON a.id = h.appointment_id
         JOIN persons p ON p.id = a.person_id
         JOIN organization_posts op ON op.id = a.post_id
         WHERE op.organization_id = ?
         ORDER BY h.changed_at DESC`
      )
      .all(organizationId) as Record<string, unknown>[]
  ).map((row) => ({
    id: String(row.id),
    appointmentId: String(row.appointment_id),
    changedAt: String(row.changed_at),
    action: String(row.action),
    notes: String(row.notes ?? ""),
    fieldNames: JSON.parse(String(row.field_names || "[]")) as string[],
    officeHolderName: String(row.office_holder_name),
    postTitle: String(row.post_title)
  }));
}

export function postCapacity(db: Database.Database, post: OrganizationPost): OrgPostCapacity {
  const covering = listAppointments(db, { organizationId: post.organizationId, postId: post.id, coveringOnly: true });
  const verifiedCovering = covering.filter((item) => item.verificationStatus === "verified");
  const overlapping = covering.some((item, index) =>
    covering.some(
      (other, otherIndex) =>
        otherIndex > index && rangesOverlap(item.startDate, item.endDate, other.startDate, other.endDate)
    )
  );
  const authorized = post.authorizedPositions;
  if (authorized == null || post.verificationStatus !== "verified") {
    return {
      postId: post.id,
      title: post.title,
      unitName: post.unitName ?? "",
      organizationId: post.organizationId,
      authorizedPositions: authorized,
      coveringCount: covering.length,
      verifiedCoveringCount: verifiedCovering.length,
      occupancy: "status_unknown",
      vacantPositions: null,
      overlapping,
      reason:
        authorized == null
          ? "Authorized positions are not documented. Vacancy is not inferred."
          : "Post record is not verified. Vacancy is not inferred."
    };
  }
  if (covering.some((item) => item.verificationStatus !== "verified")) {
    return {
      postId: post.id,
      title: post.title,
      unitName: post.unitName ?? "",
      organizationId: post.organizationId,
      authorizedPositions: authorized,
      coveringCount: covering.length,
      verifiedCoveringCount: verifiedCovering.length,
      occupancy: "status_unknown",
      vacantPositions: null,
      overlapping,
      reason: "One or more covering appointments are not verified. Vacancy is not inferred."
    };
  }
  if (verifiedCovering.length > authorized) {
    return {
      postId: post.id,
      title: post.title,
      unitName: post.unitName ?? "",
      organizationId: post.organizationId,
      authorizedPositions: authorized,
      coveringCount: covering.length,
      verifiedCoveringCount: verifiedCovering.length,
      occupancy: "overfilled",
      vacantPositions: 0,
      overlapping,
      reason: "Verified covering appointments exceed the documented authorized positions."
    };
  }
  if (verifiedCovering.length === authorized) {
    return {
      postId: post.id,
      title: post.title,
      unitName: post.unitName ?? "",
      organizationId: post.organizationId,
      authorizedPositions: authorized,
      coveringCount: covering.length,
      verifiedCoveringCount: verifiedCovering.length,
      occupancy: "appointment_recorded",
      vacantPositions: 0,
      overlapping,
      reason: "Documented authorized positions are filled by verified covering appointments."
    };
  }
  return {
    postId: post.id,
    title: post.title,
    unitName: post.unitName ?? "",
    organizationId: post.organizationId,
    authorizedPositions: authorized,
    coveringCount: covering.length,
    verifiedCoveringCount: verifiedCovering.length,
    occupancy: "verified_vacancy",
    vacantPositions: authorized - verifiedCovering.length,
    overlapping,
    reason: "Verified covering appointments are fewer than documented authorized positions."
  };
}

export function listCapacities(db: Database.Database, organizationId: string): OrgPostCapacity[] {
  return listPosts(db, { organizationId }).map((post) => postCapacity(db, post));
}

export function upcomingExpiry(
  db: Database.Database,
  organizationId: string,
  windowDays: 30 | 60 | 90
): OrganizationAppointment[] {
  const today = localDateString();
  const until = addDays(today, windowDays);
  return listAppointments(db, { organizationId, coveringOnly: true }).filter(
    (item) => item.endDate && item.endDate >= today && item.endDate <= until
  );
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  return localDateString(dt);
}

export function orgOverview(db: Database.Database, organizationId?: string): OrgOverview {
  const orgs = organizationId ? [getOrganization(db, organizationId)] : listOrganizations(db);
  let units = 0;
  let posts = 0;
  let holders = 0;
  let vacancies = 0;
  let unknown = 0;
  let expiry = 0;
  let overlapping = 0;
  for (const org of orgs) {
    units += listUnits(db, { organizationId: org.id }).length;
    const caps = listCapacities(db, org.id);
    posts += caps.length;
    holders += listAppointments(db, { organizationId: org.id, coveringOnly: true }).length;
    vacancies += caps.filter((item) => item.occupancy === "verified_vacancy").reduce((sum, item) => sum + (item.vacantPositions ?? 0), 0);
    unknown += caps.filter((item) => item.occupancy === "status_unknown").length;
    expiry += upcomingExpiry(db, org.id, 30).length;
    overlapping += caps.filter((item) => item.overlapping).length;
  }
  return {
    organizations: orgs.length,
    units,
    posts,
    currentOfficeHolders: holders,
    verifiedVacancies: vacancies,
    unknownStatus: unknown,
    upcomingExpiry30: expiry,
    overlappingAppointments: overlapping
  };
}

export function orgAssociationForGeo(
  db: Database.Database,
  geoType: OrgGeoType,
  geoId: string
): OrgGeoAssociation {
  const unitIds = (
    db
      .prepare("SELECT unit_id FROM organization_unit_geo WHERE geo_type = ? AND geo_id = ?")
      .all(geoType, geoId) as Array<{ unit_id: string }>
  ).map((row) => row.unit_id);
  if (!unitIds.length) {
    return {
      associatedUnits: 0,
      associatedPosts: 0,
      currentOfficeHolders: 0,
      unknownStatusPosts: 0,
      verifiedVacancies: 0,
      href: "/org-posts"
    };
  }
  const posts = (
    db
      .prepare(
        `SELECT * FROM organization_posts WHERE archived = 0 AND unit_id IN (${unitIds.map(() => "?").join(",")})`
      )
      .all(...unitIds) as Record<string, unknown>[]
  ).map(mapPost);
  const caps = posts.map((post) => postCapacity(db, post));
  const holders = posts.reduce(
    (sum, post) =>
      sum + listAppointments(db, { organizationId: post.organizationId, postId: post.id, coveringOnly: true }).length,
    0
  );
  return {
    associatedUnits: unitIds.length,
    associatedPosts: posts.length,
    currentOfficeHolders: holders,
    unknownStatusPosts: caps.filter((item) => item.occupancy === "status_unknown").length,
    verifiedVacancies: caps
      .filter((item) => item.occupancy === "verified_vacancy")
      .reduce((sum, item) => sum + (item.vacantPositions ?? 0), 0),
    href: "/org-posts"
  };
}

function fingerprintOf(filePath: string, kind: OrgImportKind, organizationId: string): string {
  const hash = createHash("sha256");
  hash.update(organizationId);
  hash.update(kind);
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function readSimpleTable(filePath: string): Promise<{ headers: string[]; rows: string[][] }> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".txt") {
    const table = parseCsv(fs.readFileSync(filePath, "utf8"));
    if (!table.length) throw new AppError("invalid_import", "The file is empty.");
    return { headers: table[0]!.map((cell) => cell.trim()), rows: table.slice(1) };
  }
  if (ext !== ".xlsx" && ext !== ".xls") throw new AppError("invalid_import", "Use CSV or XLSX.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError("invalid_import", "The workbook has no worksheets.");
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cell.text?.trim() ?? "";
    });
    table.push(values.map((cell) => cell ?? ""));
  });
  if (!table.length) throw new AppError("invalid_import", "The worksheet is empty.");
  return { headers: table[0]!.map((cell) => cell.trim()), rows: table.slice(1) };
}

function defaultMapping(kind: OrgImportKind, headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const field of orgTemplateFields(kind)) {
    mapping[field] = headers.find((header) => header.toLowerCase().replaceAll(" ", "_") === field) ?? null;
  }
  return mapping;
}

function rowValues(headers: string[], row: string[], mapping: Record<string, string | null>): Record<string, string> {
  const source: Record<string, string> = {};
  headers.forEach((header, index) => {
    source[header] = (row[index] ?? "").trim();
  });
  const values: Record<string, string> = {};
  for (const [field, header] of Object.entries(mapping)) {
    values[field] = header ? (source[header] ?? "").trim() : "";
  }
  return values;
}

function previewImport(state: OrgImportState, db: Database.Database): OrgImportSession {
  const preview: OrgImportPreviewRow[] = [];
  const seenUnits = new Set<string>();
  const seenPosts = new Set<string>();
  const seenAppts = new Set<string>();
  const draftCovering: Array<{ postId: string; start: string; end: string | null }> = [];
  for (let i = 0; i < state.rows.length; i += 1) {
    const values = rowValues(state.headers, state.rows[i]!, state.session.mapping);
    if (Object.values(values).every((value) => !value)) continue;
    const issues: string[] = [];
    let duplicate = false;
    let overlapping = false;
    if (state.session.kind === "units") {
      if (!values.name) issues.push("Unit name is required.");
      if (!values.unit_kind || !(ORG_UNIT_KINDS as readonly string[]).includes(values.unit_kind)) {
        issues.push("unit_kind must be committee or unit.");
      }
      if (!values.level || !(ORG_UNIT_LEVELS as readonly string[]).includes(values.level)) {
        issues.push("level is missing or unsupported.");
      }
      if (values.verification_status && !(VERIFICATION_STATUSES as readonly string[]).includes(values.verification_status)) {
        issues.push("verification_status is invalid.");
      }
      if (values.parent_unit_id && !db.prepare("SELECT 1 FROM organization_units WHERE id = ?").get(values.parent_unit_id)) {
        issues.push("parent_unit_id does not match a recorded unit.");
      }
      const unitKey = (values.name ?? "").toLowerCase();
      if (
        values.name &&
        (seenUnits.has(unitKey) ||
          db
            .prepare("SELECT 1 FROM organization_units WHERE organization_id = ? AND name = ? AND archived = 0")
            .get(state.session.organizationId, values.name))
      ) {
        duplicate = true;
        issues.push("A unit with this name already exists. It will not be merged.");
      } else if (values.name) seenUnits.add(unitKey);
    } else if (state.session.kind === "posts") {
      if (!values.unit_id) issues.push("unit_id is required.");
      else if (!db.prepare("SELECT 1 FROM organization_units WHERE id = ?").get(values.unit_id)) {
        issues.push("unit_id does not match a recorded unit.");
      }
      if (!values.title) issues.push("Post title is required. Do not invent titles.");
      if (values.authorized_positions && !/^\d+$/.test(values.authorized_positions)) {
        issues.push("authorized_positions must be a documented non-negative integer or blank.");
      }
      if (values.parent_post_id) {
        if (!db.prepare("SELECT 1 FROM organization_posts WHERE id = ?").get(values.parent_post_id)) {
          issues.push("parent_post_id does not match a recorded post.");
        }
      }
      const postKey = `${values.unit_id}::${(values.title ?? "").toLowerCase()}`;
      if (
        values.title &&
        values.unit_id &&
        (seenPosts.has(postKey) ||
          db
            .prepare("SELECT 1 FROM organization_posts WHERE unit_id = ? AND title = ? AND archived = 0")
            .get(values.unit_id, values.title))
      ) {
        duplicate = true;
        issues.push("A post with this title already exists on the unit. It will not be merged.");
      } else if (values.title && values.unit_id) seenPosts.add(postKey);
    } else {
      if (!values.post_id) issues.push("post_id is required.");
      else if (!db.prepare("SELECT 1 FROM organization_posts WHERE id = ?").get(values.post_id)) {
        issues.push("post_id does not match a recorded post.");
      }
      if (!values.office_holder_name) issues.push("office_holder_name is required.");
      if (!values.start_date || (!isIsoDate(values.start_date) && !DATE.test(values.start_date))) {
        issues.push("start_date must be YYYY-MM-DD.");
      }
      if (values.end_date && !isIsoDate(values.end_date) && !DATE.test(values.end_date)) {
        issues.push("end_date must be YYYY-MM-DD or blank.");
      }
      if (!values.status || !(ORG_APPOINTMENT_STATUSES as readonly string[]).includes(values.status)) {
        issues.push("status must be scheduled, active, ended, resigned, or cancelled.");
      }
      const apptStatus = values.status ?? "";
      const apptStart = values.start_date ?? "";
      const apptPost = values.post_id ?? "";
      if (apptPost && apptStart && COVERING.has(apptStatus)) {
        const end = values.end_date || null;
        const dbOverlap = overlappingAppointments(db, apptPost, apptStart, end).length > 0;
        const fileOverlap = draftCovering.some(
          (item) => item.postId === apptPost && rangesOverlap(apptStart, end, item.start, item.end)
        );
        if (dbOverlap || fileOverlap) {
          overlapping = true;
          issues.push("Overlaps an existing covering appointment. Both can be stored only with explicit confirmation.");
        }
        draftCovering.push({ postId: apptPost, start: apptStart, end });
      }
      const apptKey = `${apptPost}::${(values.office_holder_name ?? "").toLowerCase()}::${apptStart}`;
      if (
        values.post_id &&
        values.office_holder_name &&
        values.start_date &&
        (seenAppts.has(apptKey) ||
          db
            .prepare(
              `SELECT 1 FROM organization_appointments a
               JOIN persons p ON p.id = a.person_id
               WHERE a.post_id = ? AND p.name = ? AND a.start_date = ?`
            )
            .get(values.post_id, values.office_holder_name, values.start_date))
      ) {
        duplicate = true;
        issues.push("An appointment with this holder, post and start date already exists. It will not be merged.");
      } else if (values.post_id && values.office_holder_name && values.start_date) seenAppts.add(apptKey);
    }
    preview.push({
      index: i + 1,
      values,
      issues,
      duplicate,
      overlapping,
      importable: issues.length === 0
    });
  }
  state.session.preview = preview;
  state.session.eligibleCount = preview.filter((row) => row.importable).length;
  state.session.unresolvedCount = preview.filter((row) => !row.importable && !row.duplicate && !row.overlapping).length;
  state.session.duplicateCount = preview.filter((row) => row.duplicate).length;
  state.session.overlapCount = preview.filter((row) => row.overlapping).length;
  return state.session;
}

export async function openOrgImport(
  db: Database.Database,
  input: { organizationId: string; kind: OrgImportKind; filePath: string }
): Promise<OrgImportSession> {
  if (!(ORG_IMPORT_KINDS as readonly string[]).includes(input.kind)) {
    throw new AppError("validation", "Import kind must be units, posts, or appointments.");
  }
  getOrganization(db, input.organizationId);
  const table = await readSimpleTable(input.filePath);
  const fingerprint = fingerprintOf(input.filePath, input.kind, input.organizationId);
  const existing = db
    .prepare(
      "SELECT id FROM organization_import_batches WHERE organization_id = ? AND kind = ? AND fingerprint = ? AND status = 'committed'"
    )
    .get(input.organizationId, input.kind, fingerprint);
  if (existing) throw new AppError("duplicate_import", "This file was already committed for this organization and kind.");
  const sessionId = newId();
  const session: OrgImportSession = {
    sessionId,
    organizationId: input.organizationId,
    kind: input.kind,
    fileName: path.basename(input.filePath),
    headers: table.headers,
    mapping: defaultMapping(input.kind, table.headers),
    preview: [],
    eligibleCount: 0,
    unresolvedCount: 0,
    duplicateCount: 0,
    overlapCount: 0
  };
  const state: OrgImportState = {
    session,
    filePath: input.filePath,
    fingerprint,
    rows: table.rows,
    headers: table.headers
  };
  sessions.set(sessionId, state);
  return previewImport(state, db);
}

export function mapOrgImport(
  db: Database.Database,
  input: { sessionId: string; mapping: Record<string, string | null> }
): OrgImportSession {
  const state = sessions.get(input.sessionId);
  if (!state) throw new AppError("not_found", "Import session not found.");
  state.session.mapping = input.mapping;
  return previewImport(state, db);
}

export function cancelOrgImport(sessionId: string): void {
  sessions.delete(sessionId);
}

export function commitOrgImport(
  db: Database.Database,
  input: { sessionId: string; confirmOverlaps?: boolean }
): OrgImportCommitResult {
  const state = sessions.get(input.sessionId);
  if (!state) throw new AppError("not_found", "Import session not found.");
  previewImport(state, db);
  const overlapping = state.session.preview.filter((row) => row.overlapping);
  if (overlapping.length && !input.confirmOverlaps) {
    throw new AppError("overlap", "Overlapping appointments require explicit confirmation. Nothing was merged.");
  }
  const batchId = newId();
  const ts = nowIso();
  let imported = 0;
  db.transaction(() => {
    db.prepare(
      `INSERT INTO organization_import_batches (id, organization_id, kind, file_name, fingerprint, status, created_at, committed_at)
       VALUES (?, ?, ?, ?, ?, 'committed', ?, ?)`
    ).run(batchId, state.session.organizationId, state.session.kind, state.session.fileName, state.fingerprint, ts, ts);
    for (const row of state.session.preview) {
      if (row.duplicate) continue;
      const overlapOnly =
        row.overlapping &&
        row.issues.every((issue) => issue.includes("Overlaps an existing covering appointment"));
      if (row.overlapping && !input.confirmOverlaps) continue;
      if (!row.importable && !(overlapOnly && input.confirmOverlaps)) continue;
      const v = row.values;
      const text = (key: string) => v[key] ?? "";
      if (state.session.kind === "units") {
        const unit = createUnit(db, {
          organizationId: state.session.organizationId,
          name: text("name"),
          unitKind: text("unit_kind") as OrgUnitKind,
          level: text("level") as OrgUnitLevel,
          sourceReference: text("source_reference"),
          verificationStatus: (text("verification_status") as VerificationStatus) || "unverified",
          wingId: findWingId(db, state.session.organizationId, text("wing_name")),
          parentUnitId: text("parent_unit_id") || null
        });
        if (text("geo_type") && text("geo_id")) {
          setUnitGeo(db, { unitId: unit.id, links: [{ geoType: text("geo_type") as OrgGeoType, geoId: text("geo_id") }] });
        }
        imported += 1;
      } else if (state.session.kind === "posts") {
        createPost(db, {
          organizationId: state.session.organizationId,
          unitId: text("unit_id"),
          title: text("title"),
          wingId: findWingId(db, state.session.organizationId, text("wing_name")),
          authorizedPositions: text("authorized_positions") ? Number(text("authorized_positions")) : null,
          parentPostId: text("parent_post_id") || null,
          sourceReference: text("source_reference"),
          verificationStatus: (text("verification_status") as VerificationStatus) || "unverified"
        });
        imported += 1;
      } else {
        createAppointment(db, {
          postId: text("post_id"),
          officeHolderName: text("office_holder_name"),
          membershipReference: text("membership_reference"),
          appointmentReference: text("appointment_reference"),
          appointmentDate: text("appointment_date") || null,
          startDate: text("start_date"),
          endDate: text("end_date") || null,
          status: text("status") as OrganizationAppointment["status"],
          consentSource: text("consent_source"),
          verificationStatus: (text("verification_status") as VerificationStatus) || "unverified",
          verificationNotes: text("verification_notes"),
          sourceFilename: state.session.fileName,
          sourceRow: row.index,
          allowOverlap: Boolean(input.confirmOverlaps)
        });
        imported += 1;
      }
    }
  })();
  sessions.delete(input.sessionId);
  return {
    imported,
    unresolved: state.session.unresolvedCount,
    duplicates: state.session.duplicateCount,
    overlaps: state.session.overlapCount,
    batchId
  };
}

function findWingId(db: Database.Database, organizationId: string, name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = db
    .prepare("SELECT id FROM organization_wings WHERE organization_id = ? AND name = ? AND archived = 0")
    .get(organizationId, trimmed) as { id: string } | undefined;
  if (existing) return existing.id;
  return createWing(db, { organizationId, name: trimmed }).id;
}

export function orgTemplateCsv(kind: OrgImportKind): string {
  return stringifyCsv([ [...orgTemplateFields(kind)] ]);
}

export async function orgTemplateXlsx(kind: OrgImportKind): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(kind);
  sheet.addRow([...orgTemplateFields(kind)]);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportOrgCsv(db: Database.Database, input: OrgExportInput): string {
  const rows = exportRows(db, input);
  return stringifyCsv(rows.map((row) => row.map((cell) => guardSpreadsheetCell(cell))));
}

export async function exportOrgXlsx(db: Database.Database, input: OrgExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(input.kind);
  for (const row of exportRows(db, input)) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function exportRows(db: Database.Database, input: OrgExportInput): string[][] {
  const fields = input.fields.length ? input.fields : [...orgTemplateFields(input.kind)];
  const header = fields;
  const body: string[][] = [];
  if (input.kind === "units") {
    for (const unit of listUnits(db, { organizationId: input.organizationId })) {
      const first = unit.geo[0];
      const record: Record<string, string> = {
        id: unit.id,
        name: unit.name,
        unit_kind: unit.unitKind,
        level: unit.level,
        wing_name: unit.wingName ?? "",
        parent_unit_id: unit.parentUnitId ?? "",
        source_reference: unit.sourceReference,
        verification_status: unit.verificationStatus,
        geo_type: first?.geoType ?? "",
        geo_id: first?.geoId ?? ""
      };
      body.push(fields.map((field) => record[field] ?? ""));
    }
  } else if (input.kind === "posts") {
    for (const post of listPosts(db, { organizationId: input.organizationId })) {
      const record: Record<string, string> = {
        id: post.id,
        unit_id: post.unitId,
        title: post.title,
        wing_name: post.wingName ?? "",
        authorized_positions: post.authorizedPositions == null ? "" : String(post.authorizedPositions),
        parent_post_id: post.parentPostId ?? "",
        source_reference: post.sourceReference,
        verification_status: post.verificationStatus
      };
      body.push(fields.map((field) => record[field] ?? ""));
    }
  } else {
    for (const appt of listAppointments(db, { organizationId: input.organizationId, includeEnded: true })) {
      const record: Record<string, string> = {
        id: appt.id,
        post_id: appt.postId,
        office_holder_name: appt.officeHolderName,
        membership_reference: appt.membershipReference,
        appointment_reference: appt.appointmentReference,
        appointment_date: appt.appointmentDate ?? "",
        start_date: appt.startDate,
        end_date: appt.endDate ?? "",
        status: appt.status,
        consent_source: appt.consentSource,
        verification_status: appt.verificationStatus,
        verification_notes: appt.verificationNotes
      };
      body.push(fields.map((field) => record[field] ?? ""));
    }
  }
  return [header, ...body];
}

export function orgImportSession(sessionId: string): OrgImportSession {
  const state = sessions.get(sessionId);
  if (!state) throw new AppError("not_found", "Import session not found.");
  return state.session;
}

export function clearOrgImportSessions(): void {
  sessions.clear();
}
