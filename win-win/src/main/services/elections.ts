import type Database from "better-sqlite3";
import type { ElectionCoverageLink, ElectionWorkspace, ElectionWardLink, UnitType } from "@shared/types";
import type { ElectionWriteInput } from "@shared/ipc";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { mapElection, mapElectionCoverage, mapElectionWard } from "../db/mappers";
import { writeAudit } from "./audit";
import { resolveScope, unitExists, wardInScope } from "./coverage";
import { getWard } from "./wards";

function unitName(db: Database.Database, unitType: UnitType, unitId: string): string {
  const table: Record<UnitType, string> = {
    mandal: "mandals",
    gram_panchayat: "gram_panchayats",
    village: "villages",
    urban_local_body: "urban_local_bodies",
    rural_ward: "wards",
    urban_ward: "wards"
  };
  const row = db.prepare(`SELECT name FROM ${table[unitType]} WHERE id = ?`).get(unitId) as { name?: string } | undefined;
  return row?.name ?? unitId;
}

function buildSnapshot(db: Database.Database, electionId: string): string {
  const election = mapElection(db.prepare("SELECT * FROM elections WHERE id = ?").get(electionId) as Record<string, unknown>);
  const wards = listElectionWards(db, electionId);
  const coverage = listElectionCoverage(db, electionId);
  const constituency = db.prepare("SELECT name, name_te FROM assembly_constituencies WHERE id = ?").get(election.constituencyId) as
    | { name: string; name_te: string }
    | undefined;
  const version = db.prepare("SELECT name, effective_from, effective_to FROM boundary_versions WHERE id = ?").get(
    election.boundaryVersionId
  ) as { name: string; effective_from: string; effective_to: string | null } | undefined;
  return JSON.stringify({
    capturedAt: nowIso(),
    election: {
      name: election.name,
      type: election.electionType,
      year: election.year,
      constituencyId: election.constituencyId,
      constituencyName: constituency?.name ?? "",
      boundaryVersionId: election.boundaryVersionId,
      boundaryVersionName: version?.name ?? ""
    },
    wards,
    coverage
  });
}

export function listElections(
  db: Database.Database,
  input?: { constituencyId?: string; includeArchived?: boolean }
): ElectionWorkspace[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (input?.constituencyId) {
    clauses.push("constituency_id = ?");
    params.push(input.constituencyId);
  }
  if (!input?.includeArchived) clauses.push("status != 'archived'");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (db.prepare(`SELECT * FROM elections ${where} ORDER BY year DESC, name`).all(...params) as Record<string, unknown>[]).map(
    mapElection
  );
}

export function getElection(db: Database.Database, id: string): {
  election: ElectionWorkspace;
  wards: ElectionWardLink[];
  coverage: ElectionCoverageLink[];
} {
  const row = db.prepare("SELECT * FROM elections WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Election workspace not found.");
  return {
    election: mapElection(row),
    wards: listElectionWards(db, id),
    coverage: listElectionCoverage(db, id)
  };
}

function listElectionWards(db: Database.Database, electionId: string): ElectionWardLink[] {
  return (db.prepare("SELECT * FROM election_wards WHERE election_id = ?").all(electionId) as Record<string, unknown>[]).map(
    mapElectionWard
  );
}

function listElectionCoverage(db: Database.Database, electionId: string): ElectionCoverageLink[] {
  return (db.prepare("SELECT * FROM election_coverage WHERE election_id = ?").all(electionId) as Record<string, unknown>[]).map(
    mapElectionCoverage
  );
}

function replaceLinks(db: Database.Database, electionId: string, input: ElectionWriteInput): void {
  const scope = resolveScope(db, input.constituencyId, input.boundaryVersionId);
  db.prepare("DELETE FROM election_wards WHERE election_id = ?").run(electionId);
  db.prepare("DELETE FROM election_coverage WHERE election_id = ?").run(electionId);
  const insertWard = db.prepare(
    `INSERT INTO election_wards (election_id, ward_id, ward_number_snapshot, ward_name_snapshot, classification_snapshot)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const wardId of input.wardIds) {
    const ward = getWard(db, wardId);
    if (ward.boundaryVersionId !== input.boundaryVersionId) {
      throw new AppError("invalid_election_ward", "Selected wards must belong to the election's boundary version.");
    }
    if (!wardInScope(scope, ward.id, ward.classification)) {
      throw new AppError(
        "invalid_election_ward",
        `Ward ${ward.wardNumber} is not in the selected constituency coverage for this boundary version.`
      );
    }
    insertWard.run(electionId, ward.id, ward.wardNumber, ward.name, ward.classification);
  }
  const insertCov = db.prepare(
    `INSERT INTO election_coverage (id, election_id, unit_type, unit_id, coverage_kind, unit_name_snapshot)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const item of input.coverage) {
    if (!unitExists(db, item.unitType, item.unitId)) {
      throw new AppError("invalid_coverage_unit", "Election coverage must reference an existing geographic unit.");
    }
    insertCov.run(newId(), electionId, item.unitType, item.unitId, item.coverageKind, unitName(db, item.unitType, item.unitId));
  }
}

export function createElection(db: Database.Database, input: ElectionWriteInput, isDemo = false): ElectionWorkspace {
  if (!input.name.trim()) throw new AppError("validation", "Election name is required.");
  if (!Number.isInteger(input.year) || input.year < 1950 || input.year > 2100) {
    throw new AppError("validation", "Enter a valid election year.");
  }
  const constituency = db.prepare("SELECT id FROM assembly_constituencies WHERE id = ?").get(input.constituencyId);
  if (!constituency) throw new AppError("invalid_parent", "Constituency not found.");
  const version = db.prepare("SELECT id FROM boundary_versions WHERE id = ?").get(input.boundaryVersionId);
  if (!version) throw new AppError("invalid_parent", "Boundary version not found.");
  const id = newId();
  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO elections (
        id, name, election_type, year, constituency_id, boundary_version_id, status, notes, snapshot_json, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).run(
      id,
      input.name.trim(),
      input.electionType,
      input.year,
      input.constituencyId,
      input.boundaryVersionId,
      input.status === "archived" ? "draft" : (input.status ?? "draft"),
      input.notes ?? "",
      isDemo ? 1 : 0,
      ts,
      ts
    );
    replaceLinks(db, id, input);
    const snapshot = buildSnapshot(db, id);
    db.prepare("UPDATE elections SET snapshot_json = ? WHERE id = ?").run(snapshot, id);
    writeAudit(db, {
      action: "create",
      entityType: "election",
      recordId: id,
      changedFields: ["name", "electionType", "year", "boundaryVersionId", "wardIds"]
    });
  });
  tx();
  return mapElection(db.prepare("SELECT * FROM elections WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateElection(db: Database.Database, input: ElectionWriteInput & { id: string }): ElectionWorkspace {
  const current = getElection(db, input.id).election;
  if (current.status === "archived") {
    throw new AppError("archived_locked", "Archived election workspaces cannot be edited. Historical geographic references are preserved.");
  }
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE elections SET name = ?, election_type = ?, year = ?, constituency_id = ?, boundary_version_id = ?, status = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.name.trim(),
      input.electionType,
      input.year,
      input.constituencyId,
      input.boundaryVersionId,
      input.status === "archived" ? current.status : (input.status ?? current.status),
      input.notes ?? "",
      nowIso(),
      input.id
    );
    replaceLinks(db, input.id, input);
    const snapshot = buildSnapshot(db, input.id);
    db.prepare("UPDATE elections SET snapshot_json = ? WHERE id = ?").run(snapshot, input.id);
    writeAudit(db, {
      action: "update",
      entityType: "election",
      recordId: input.id,
      changedFields: ["name", "electionType", "year", "boundaryVersionId", "wardIds", "status"]
    });
  });
  tx();
  return getElection(db, input.id).election;
}

export function archiveElection(db: Database.Database, id: string): ElectionWorkspace {
  const current = getElection(db, id).election;
  if (current.status === "archived") return current;
  const snapshot = buildSnapshot(db, id);
  db.prepare("UPDATE elections SET status = 'archived', snapshot_json = ?, updated_at = ? WHERE id = ?").run(
    snapshot,
    nowIso(),
    id
  );
  writeAudit(db, { action: "archive", entityType: "election", recordId: id, changedFields: ["status"] });
  return getElection(db, id).election;
}
