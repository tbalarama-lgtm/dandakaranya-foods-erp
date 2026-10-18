import type Database from "better-sqlite3";
import { PAGE_SIZE } from "@shared/constants";
import type {
  DuplicatePair,
  PagedResult,
  RollEdition,
  VerificationStatus,
  VoterEntry,
  VoterFilters,
  VoterListItem
} from "@shared/types";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { writeAudit } from "./audit";
import { assertWardInConstituency } from "./scope";

function display(source: string, local: string | null): string {
  return local != null && local !== "" ? local : source;
}

export function mapEdition(row: Record<string, unknown>): RollEdition {
  return {
    id: String(row.id),
    constituencyId: String(row.constituency_id),
    boundaryVersionId: String(row.boundary_version_id),
    name: String(row.name),
    revisionCode: String(row.revision_code ?? ""),
    publishedOn: row.published_on ? String(row.published_on) : null,
    notes: String(row.notes ?? ""),
    archived: Number(row.archived) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapVoter(row: Record<string, unknown>): VoterEntry {
  return {
    id: String(row.id),
    rollEditionId: String(row.roll_edition_id),
    constituencyId: String(row.constituency_id),
    importBatchId: row.import_batch_id ? String(row.import_batch_id) : null,
    sourceRowNumber: row.source_row_number == null ? null : Number(row.source_row_number),
    sourceName: String(row.source_name ?? ""),
    sourceNameEn: String(row.source_name_en ?? ""),
    sourceElectoralId: String(row.source_electoral_id ?? ""),
    sourceRollSerial: String(row.source_roll_serial ?? ""),
    sourceAge: String(row.source_age ?? ""),
    sourceAgeReferenceDate: String(row.source_age_reference_date ?? ""),
    sourceAddress: String(row.source_address ?? ""),
    sourceSection: String(row.source_section ?? ""),
    sourcePage: String(row.source_page ?? ""),
    sourceWardLabel: String(row.source_ward_label ?? ""),
    localName: row.local_name == null ? null : String(row.local_name),
    localNameEn: row.local_name_en == null ? null : String(row.local_name_en),
    localElectoralId: row.local_electoral_id == null ? null : String(row.local_electoral_id),
    localRollSerial: row.local_roll_serial == null ? null : String(row.local_roll_serial),
    localAge: row.local_age == null ? null : String(row.local_age),
    localAgeReferenceDate: row.local_age_reference_date == null ? null : String(row.local_age_reference_date),
    localAddress: row.local_address == null ? null : String(row.local_address),
    assignedWardId: row.assigned_ward_id ? String(row.assigned_ward_id) : null,
    verificationStatus: String(row.verification_status) as VerificationStatus,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    archived: Number(row.archived) === 1,
    archiveReason: String(row.archive_reason ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function toListItem(
  db: Database.Database,
  voter: VoterEntry,
  editionName?: string
): VoterListItem {
  const name =
    editionName ??
    (db.prepare("SELECT name FROM roll_editions WHERE id = ?").get(voter.rollEditionId) as { name: string } | undefined)
      ?.name ??
    "";
  let wardLabel: string | null = null;
  if (voter.assignedWardId) {
    const ward = db
      .prepare("SELECT ward_number, name FROM wards WHERE id = ?")
      .get(voter.assignedWardId) as { ward_number: string; name: string } | undefined;
    wardLabel = ward ? `${ward.ward_number} — ${ward.name}` : voter.assignedWardId;
  }
  return {
    ...voter,
    displayName: display(voter.sourceName, voter.localName),
    displayNameEn: display(voter.sourceNameEn, voter.localNameEn),
    displayElectoralId: display(voter.sourceElectoralId, voter.localElectoralId),
    displayRollSerial: display(voter.sourceRollSerial, voter.localRollSerial),
    displayAddress: display(voter.sourceAddress, voter.localAddress),
    wardLabel,
    editionName: name
  };
}

export function listEditions(db: Database.Database, constituencyId: string, includeArchived = false): RollEdition[] {
  const sql = includeArchived
    ? "SELECT * FROM roll_editions WHERE constituency_id = ? ORDER BY created_at DESC"
    : "SELECT * FROM roll_editions WHERE constituency_id = ? AND archived = 0 ORDER BY created_at DESC";
  return (db.prepare(sql).all(constituencyId) as Record<string, unknown>[]).map(mapEdition);
}

export function createEdition(
  db: Database.Database,
  input: {
    constituencyId: string;
    boundaryVersionId: string;
    name: string;
    revisionCode?: string;
    publishedOn?: string | null;
    notes?: string;
  }
): RollEdition {
  if (!input.name.trim()) throw new AppError("validation", "Roll edition name is required.");
  const constituency = db.prepare("SELECT id FROM assembly_constituencies WHERE id = ?").get(input.constituencyId);
  if (!constituency) throw new AppError("not_found", "Constituency not found.");
  const version = db.prepare("SELECT id FROM boundary_versions WHERE id = ?").get(input.boundaryVersionId);
  if (!version) throw new AppError("not_found", "Boundary version not found.");
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO roll_editions (id, constituency_id, boundary_version_id, name, revision_code, published_on, notes, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.constituencyId,
    input.boundaryVersionId,
    input.name.trim(),
    input.revisionCode ?? "",
    input.publishedOn ?? null,
    input.notes ?? "",
    ts,
    ts
  );
  writeAudit(db, { action: "create", entityType: "roll_edition", recordId: id, changedFields: ["name", "revisionCode"] });
  return mapEdition(db.prepare("SELECT * FROM roll_editions WHERE id = ?").get(id) as Record<string, unknown>);
}

export function getEdition(db: Database.Database, id: string): RollEdition {
  const row = db.prepare("SELECT * FROM roll_editions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Roll edition not found.");
  return mapEdition(row);
}

function writeVoterHistory(db: Database.Database, voterId: string, action: string, fields: string[]): void {
  db.prepare("INSERT INTO voter_change_history (id, voter_id, changed_at, action, field_names) VALUES (?, ?, ?, ?, ?)").run(
    newId(),
    voterId,
    nowIso(),
    action,
    JSON.stringify(fields)
  );
}

export function createVoter(
  db: Database.Database,
  input: {
    rollEditionId: string;
    constituencyId: string;
    sourceName?: string;
    sourceNameEn?: string;
    sourceElectoralId?: string;
    sourceRollSerial?: string;
    sourceAge?: string;
    sourceAgeReferenceDate?: string;
    sourceAddress?: string;
    sourceSection?: string;
    sourcePage?: string;
    assignedWardId?: string | null;
    verificationStatus?: VerificationStatus;
  }
): VoterEntry {
  const edition = getEdition(db, input.rollEditionId);
  if (edition.constituencyId !== input.constituencyId) {
    throw new AppError("constituency_isolation", "Roll edition does not belong to the selected constituency.");
  }
  const name = input.sourceName?.trim() ?? "";
  const electoralId = input.sourceElectoralId?.trim() ?? "";
  if (!name && !electoralId) {
    throw new AppError("validation", "Provide a name or an electoral identifier. Names are not unique identifiers.");
  }
  if (input.assignedWardId) {
    assertWardInConstituency(db, input.constituencyId, input.assignedWardId, edition.boundaryVersionId);
  }
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO voter_entries (
      id, roll_edition_id, constituency_id, import_batch_id, source_row_number,
      source_name, source_name_en, source_electoral_id, source_roll_serial, source_age, source_age_reference_date,
      source_address, source_section, source_page, source_ward_label,
      assigned_ward_id, verification_status, verified_at, archived, archive_reason, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 0, '', ?, ?)`
  ).run(
    id,
    input.rollEditionId,
    input.constituencyId,
    name,
    input.sourceNameEn ?? "",
    electoralId,
    input.sourceRollSerial ?? "",
    input.sourceAge ?? "",
    input.sourceAgeReferenceDate ?? "",
    input.sourceAddress ?? "",
    input.sourceSection ?? "",
    input.sourcePage ?? "",
    input.assignedWardId ?? null,
    input.verificationStatus ?? "unverified",
    input.verificationStatus === "verified" ? ts : null,
    ts,
    ts
  );
  if (input.assignedWardId) {
    db.prepare(
      "INSERT INTO ward_assignment_history (id, voter_id, from_ward_id, to_ward_id, reason, changed_at) VALUES (?, ?, NULL, ?, ?, ?)"
    ).run(newId(), id, input.assignedWardId, "manual-create", ts);
  }
  writeVoterHistory(db, id, "create", ["sourceName", "sourceElectoralId"]);
  writeAudit(db, { action: "create", entityType: "voter_entry", recordId: id, changedFields: ["sourceName", "sourceElectoralId"] });
  return getVoter(db, id);
}

export function getVoter(db: Database.Database, id: string): VoterEntry {
  const row = db.prepare("SELECT * FROM voter_entries WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Voter record not found.");
  return mapVoter(row);
}

export function getVoterDetail(db: Database.Database, id: string): {
  voter: VoterListItem;
  changeHistory: Array<{ id: string; changedAt: string; action: string; fieldNames: string[] }>;
  assignmentHistory: Array<{ id: string; fromWardId: string | null; toWardId: string | null; reason: string; changedAt: string }>;
} {
  const voter = toListItem(db, getVoter(db, id));
  const changeHistory = (
    db.prepare("SELECT * FROM voter_change_history WHERE voter_id = ? ORDER BY changed_at DESC").all(id) as Record<string, unknown>[]
  ).map((row) => ({
    id: String(row.id),
    changedAt: String(row.changed_at),
    action: String(row.action),
    fieldNames: JSON.parse(String(row.field_names || "[]")) as string[]
  }));
  const assignmentHistory = (
    db.prepare("SELECT * FROM ward_assignment_history WHERE voter_id = ? ORDER BY changed_at DESC").all(id) as Record<string, unknown>[]
  ).map((row) => ({
    id: String(row.id),
    fromWardId: row.from_ward_id ? String(row.from_ward_id) : null,
    toWardId: row.to_ward_id ? String(row.to_ward_id) : null,
    reason: String(row.reason ?? ""),
    changedAt: String(row.changed_at)
  }));
  return { voter, changeHistory, assignmentHistory };
}

export function updateVoter(
  db: Database.Database,
  input: {
    id: string;
    constituencyId: string;
    localName?: string | null;
    localNameEn?: string | null;
    localElectoralId?: string | null;
    localRollSerial?: string | null;
    localAge?: string | null;
    localAgeReferenceDate?: string | null;
    localAddress?: string | null;
    assignedWardId?: string | null;
    verificationStatus?: VerificationStatus;
    verifiedAt?: string | null;
  }
): VoterEntry {
  const current = getVoter(db, input.id);
  if (current.constituencyId !== input.constituencyId) {
    throw new AppError("constituency_isolation", "Record is outside the selected constituency.");
  }
  const edition = getEdition(db, current.rollEditionId);
  if (input.assignedWardId) {
    assertWardInConstituency(db, input.constituencyId, input.assignedWardId, edition.boundaryVersionId);
  }
  const fields: string[] = [];
  const nextWard = input.assignedWardId === undefined ? current.assignedWardId : input.assignedWardId;
  if (input.localName !== undefined) fields.push("localName");
  if (input.localNameEn !== undefined) fields.push("localNameEn");
  if (input.localElectoralId !== undefined) fields.push("localElectoralId");
  if (input.localRollSerial !== undefined) fields.push("localRollSerial");
  if (input.localAge !== undefined) fields.push("localAge");
  if (input.localAgeReferenceDate !== undefined) fields.push("localAgeReferenceDate");
  if (input.localAddress !== undefined) fields.push("localAddress");
  if (input.assignedWardId !== undefined) fields.push("assignedWardId");
  if (input.verificationStatus !== undefined) fields.push("verificationStatus");
  const ts = nowIso();
  const verifiedAt =
    input.verificationStatus === "verified" ? input.verifiedAt ?? ts : input.verificationStatus ? null : current.verifiedAt;
  db.prepare(
    `UPDATE voter_entries SET
      local_name = ?, local_name_en = ?, local_electoral_id = ?, local_roll_serial = ?,
      local_age = ?, local_age_reference_date = ?, local_address = ?,
      assigned_ward_id = ?, verification_status = ?, verified_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.localName === undefined ? current.localName : input.localName,
    input.localNameEn === undefined ? current.localNameEn : input.localNameEn,
    input.localElectoralId === undefined ? current.localElectoralId : input.localElectoralId,
    input.localRollSerial === undefined ? current.localRollSerial : input.localRollSerial,
    input.localAge === undefined ? current.localAge : input.localAge,
    input.localAgeReferenceDate === undefined ? current.localAgeReferenceDate : input.localAgeReferenceDate,
    input.localAddress === undefined ? current.localAddress : input.localAddress,
    nextWard,
    input.verificationStatus ?? current.verificationStatus,
    verifiedAt,
    ts,
    input.id
  );
  if (input.assignedWardId !== undefined && input.assignedWardId !== current.assignedWardId) {
    db.prepare(
      "INSERT INTO ward_assignment_history (id, voter_id, from_ward_id, to_ward_id, reason, changed_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(newId(), input.id, current.assignedWardId, input.assignedWardId, "manual-update", ts);
  }
  writeVoterHistory(db, input.id, "update", fields);
  writeAudit(db, { action: "update", entityType: "voter_entry", recordId: input.id, changedFields: fields });
  return getVoter(db, input.id);
}

export function archiveVoter(db: Database.Database, id: string, constituencyId: string, reason: string): VoterEntry {
  const current = getVoter(db, id);
  if (current.constituencyId !== constituencyId) {
    throw new AppError("constituency_isolation", "Record is outside the selected constituency.");
  }
  if (!reason.trim()) throw new AppError("validation", "An archive reason is required. Records are not silently deleted.");
  db.prepare("UPDATE voter_entries SET archived = 1, archive_reason = ?, updated_at = ? WHERE id = ?").run(
    reason.trim(),
    nowIso(),
    id
  );
  writeVoterHistory(db, id, "archive", ["archived", "archiveReason"]);
  writeAudit(db, { action: "archive", entityType: "voter_entry", recordId: id, changedFields: ["archived"] });
  return getVoter(db, id);
}

export function assignWardsBulk(
  db: Database.Database,
  input: { constituencyId: string; voterIds: string[]; wardId: string | null; reason: string }
): number {
  if (input.voterIds.length === 0) return 0;
  const tx = db.transaction(() => {
    let count = 0;
    for (const voterId of input.voterIds) {
      const voter = getVoter(db, voterId);
      if (voter.constituencyId !== input.constituencyId) {
        throw new AppError("constituency_isolation", "A selected record is outside the constituency.");
      }
      updateVoter(db, {
        id: voterId,
        constituencyId: input.constituencyId,
        assignedWardId: input.wardId
      });
      if (input.reason) {
        db.prepare("UPDATE ward_assignment_history SET reason = ? WHERE voter_id = ? AND changed_at = (SELECT MAX(changed_at) FROM ward_assignment_history WHERE voter_id = ?)").run(
          input.reason,
          voterId,
          voterId
        );
      }
      count += 1;
    }
    return count;
  });
  return tx();
}

export function listVoters(db: Database.Database, filters: VoterFilters): PagedResult<VoterListItem> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const where: string[] = ["v.constituency_id = ?"];
  const params: unknown[] = [filters.constituencyId];
  if (!filters.includeArchived) where.push("v.archived = 0");
  if (filters.wardId) {
    where.push("v.assigned_ward_id = ?");
    params.push(filters.wardId);
  }
  if (filters.unassignedOnly) where.push("v.assigned_ward_id IS NULL");
  if (filters.rollEditionId) {
    where.push("v.roll_edition_id = ?");
    params.push(filters.rollEditionId);
  }
  if (filters.verificationStatus) {
    where.push("v.verification_status = ?");
    params.push(filters.verificationStatus);
  }
  if (filters.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    where.push(
      `(COALESCE(v.local_name, v.source_name) LIKE ? OR COALESCE(v.local_name_en, v.source_name_en) LIKE ?
        OR COALESCE(v.local_electoral_id, v.source_electoral_id) LIKE ?
        OR COALESCE(v.local_address, v.source_address) LIKE ?)`
    );
    params.push(q, q, q, q);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM voter_entries v ${whereSql}`).get(...params) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT v.*, e.name AS edition_name, w.ward_number, w.name AS ward_name
       FROM voter_entries v
       JOIN roll_editions e ON e.id = v.roll_edition_id
       LEFT JOIN wards w ON w.id = v.assigned_ward_id
       ${whereSql}
       ORDER BY e.created_at DESC, CAST(COALESCE(v.local_roll_serial, v.source_roll_serial) AS INTEGER), v.created_at
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
  const items = rows.map((row) => {
    const voter = mapVoter(row);
    return {
      ...toListItem(db, voter, String(row.edition_name ?? "")),
      wardLabel: row.ward_number ? `${row.ward_number} — ${row.ward_name}` : null
    };
  });
  return { items, total, page, pageSize };
}

export function findDuplicates(db: Database.Database, rollEditionId: string): DuplicatePair[] {
  return (
    db
      .prepare("SELECT * FROM duplicate_pairs WHERE roll_edition_id = ? ORDER BY status, id")
      .all(rollEditionId) as Record<string, unknown>[]
  ).map((row) => ({
    id: String(row.id),
    rollEditionId: String(row.roll_edition_id),
    voterAId: String(row.voter_a_id),
    voterBId: String(row.voter_b_id),
    reasons: JSON.parse(String(row.reasons_json || "[]")) as string[],
    status: row.status as DuplicatePair["status"],
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    voterA: toListItem(db, getVoter(db, String(row.voter_a_id))),
    voterB: toListItem(db, getVoter(db, String(row.voter_b_id)))
  }));
}

export function reviewDuplicate(
  db: Database.Database,
  id: string,
  status: DuplicatePair["status"]
): void {
  const row = db.prepare("SELECT id FROM duplicate_pairs WHERE id = ?").get(id);
  if (!row) throw new AppError("not_found", "Duplicate pair not found.");
  db.prepare("UPDATE duplicate_pairs SET status = ?, reviewed_at = ? WHERE id = ?").run(status, nowIso(), id);
  writeAudit(db, { action: "update", entityType: "duplicate_pair", recordId: id, changedFields: ["status"] });
}

export function flagDuplicatesForEdition(db: Database.Database, rollEditionId: string): number {
  const voters = (
    db.prepare("SELECT * FROM voter_entries WHERE roll_edition_id = ? AND archived = 0").all(rollEditionId) as Record<string, unknown>[]
  ).map(mapVoter);
  const insert = db.prepare(
    `INSERT INTO duplicate_pairs (id, roll_edition_id, voter_a_id, voter_b_id, reasons_json, status, reviewed_at)
     VALUES (?, ?, ?, ?, ?, 'flagged', NULL)
     ON CONFLICT(roll_edition_id, voter_a_id, voter_b_id) DO NOTHING`
  );
  let flagged = 0;
  const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);
  for (let i = 0; i < voters.length; i += 1) {
    for (let j = i + 1; j < voters.length; j += 1) {
      const a = voters[i]!;
      const b = voters[j]!;
      const reasons: string[] = [];
      const idA = display(a.sourceElectoralId, a.localElectoralId).trim();
      const idB = display(b.sourceElectoralId, b.localElectoralId).trim();
      if (idA && idB && idA === idB) {
        reasons.push("Same electoral identifier within this roll edition.");
      }
      const serialA = display(a.sourceRollSerial, a.localRollSerial).trim();
      const serialB = display(b.sourceRollSerial, b.localRollSerial).trim();
      const nameA = display(a.sourceName, a.localName).trim().toLowerCase();
      const nameB = display(b.sourceName, b.localName).trim().toLowerCase();
      if (serialA && serialB && serialA === serialB && nameA && nameA === nameB) {
        reasons.push("Same roll serial and name in this edition (serials are not permanent identifiers).");
      }
      const addrA = display(a.sourceAddress, a.localAddress).trim().toLowerCase();
      const addrB = display(b.sourceAddress, b.localAddress).trim().toLowerCase();
      if (nameA && nameA === nameB && addrA && addrA === addrB) {
        reasons.push("Name and address similarity — review hint only, not proof of the same person.");
      }
      if (reasons.length === 0) continue;
      const [left, right] = pair(a.id, b.id);
      const info = insert.run(newId(), rollEditionId, left, right, JSON.stringify(reasons));
      if (info.changes > 0) flagged += 1;
    }
  }
  return flagged;
}
