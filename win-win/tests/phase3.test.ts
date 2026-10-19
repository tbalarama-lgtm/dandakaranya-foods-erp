import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, SCHEMA_VERSION } from "../src/shared/constants";
import { DatabaseManager, openMemory } from "../src/main/db/connection";
import { applyMigrations, MIGRATIONS } from "../src/main/db/schema";
import { resolveDataPaths } from "../src/main/db/paths";
import { nowIso } from "../src/main/db/ids";
import { createBackup, restoreBackup } from "../src/main/services/backup";
import { setCoverage } from "../src/main/services/coverage";
import { guardSpreadsheetCell } from "../src/main/services/csv";
import { exportVotersCsv } from "../src/main/services/export-voters";
import {
  assignStagedWards,
  cancelImport,
  clearImportSessions,
  commitImport,
  createSession,
  getSession,
  readTabularFile,
  setEdition,
  setMapping,
  sha256File,
  templateCsv,
  validateSession
} from "../src/main/services/import-voters";
import {
  createBoundary,
  createConstituency,
  createGp,
  createMandal,
  createUlb
} from "../src/main/services/geo";
import { createPerson } from "../src/main/services/workspace";
import { createWard } from "../src/main/services/wards";
import {
  archiveVoter,
  createEdition,
  createVoter,
  editionCounts,
  findDuplicates,
  flagDuplicatesForEdition,
  listVoters,
  reviewDuplicate
} from "../src/main/services/voters";
import { AppError } from "../src/main/errors";

const dirs: string[] = [];
afterEach(() => {
  clearImportSessions();
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function seed(db: ReturnType<typeof openMemory>) {
  const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
  const constituency = createConstituency(db, { name: "Seat A" });
  const other = createConstituency(db, { name: "Seat B" });
  const mandal = createMandal(db, { name: "Mandal One" });
  const gp = createGp(db, { mandalId: mandal.id, name: "GP East" });
  const ulb = createUlb(db, { bodyType: "municipality", name: "Town" });
  const rural = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Rural 1"
  });
  const rural2 = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "2",
    name: "Rural 2"
  });
  const urban = createWard(db, {
    classification: "urban",
    urbanLocalBodyId: ulb.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Urban 1"
  });
  setCoverage(db, {
    constituencyId: constituency.id,
    boundaryVersionId: version.id,
    unitType: "gram_panchayat",
    unitId: gp.id,
    coverageKind: "complete"
  });
  return { version, constituency, other, rural, rural2, urban, gp, ulb };
}

function writeCsv(dir: string, name: string, body: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, "utf8");
  return file;
}

describe("Phase 3 electoral roll", () => {
  it("applies forward migration from schema v4 without resetting data", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    const ts = nowIso();
    db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const migration of MIGRATIONS.filter((m) => m.version <= 4)) {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(migration.version, ts);
    }
    db.prepare(
      `INSERT INTO boundary_versions (id, name, effective_from, notes, status, created_at) VALUES ('b1','v','2026-01-01','','active',?)`
    ).run(ts);
    db.prepare(
      `INSERT INTO assembly_constituencies (id, name, name_te, notes, archived, is_demo, created_at, updated_at)
       VALUES ('c1','Seat','','',0,0,?,?)`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO roll_editions (id, constituency_id, boundary_version_id, name, revision_code, notes, archived, created_at, updated_at)
       VALUES ('e1','c1','b1','2024 roll','r1','',0,?,?)`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO voter_entries (
        id, roll_edition_id, constituency_id, source_name, source_electoral_id, verification_status, archived, archive_reason, created_at, updated_at
      ) VALUES ('v1','e1','c1','రాము','0011','unverified',0,'',?,?)`
    ).run(ts, ts);
    applyMigrations(db);
    const version = (db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v;
    expect(version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(5);
    const cols = db.prepare("PRAGMA table_info(ward_assignment_history)").all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === "verification_source")).toBe(true);
    const voter = db.prepare("SELECT source_name, source_electoral_id FROM voter_entries WHERE id = 'v1'").get() as {
      source_name: string;
      source_electoral_id: string;
    };
    expect(voter.source_name).toBe("రాము");
    expect(voter.source_electoral_id).toBe("0011");
  });

  it("imports Telugu text and leading-zero identifiers from CSV", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const csv = writeCsv(
      dir,
      "roll.csv",
      `\uFEFFname_original,electoral_id,roll_serial,published_address,ward_number\nరాము,ABC0001,0012,వీధి,1\n`
    );
    const table = await readTabularFile(csv);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "2026 roll"
    });
    const preview = createSession(db, {
      constituencyId: geo.constituency.id,
      columns: table.columns,
      rows: table.rows,
      fileName: "roll.csv",
      sha: sha256File(csv),
      formulaMask: table.formulaMask
    });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, {
      nameOriginal: "name_original",
      electoralId: "electoral_id",
      rollSerial: "roll_serial",
      publishedAddress: "published_address",
      wardNumber: "ward_number"
    });
    const validated = await validateSession(db, preview.sessionId);
    expect(validated.errorCount).toBe(0);
    expect(validated.assignedCount).toBe(1);
    const committed = commitImport(db, preview.sessionId);
    expect(committed.imported).toBe(1);
    const listed = listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id });
    expect(listed.items[0]?.displayName).toBe("రాము");
    expect(listed.items[0]?.displayElectoralId).toBe("ABC0001");
    expect(listed.items[0]?.displayRollSerial).toBe("0012");
    expect(listed.items[0]?.displayAddress).toBe("వీధి");
    expect(listed.items[0]?.assignedWardId).toBe(geo.rural.id);
    const exported = exportVotersCsv(listed.items, ["displayName", "displayElectoralId", "displayRollSerial", "displayAddress"]);
    expect(exported).toContain("రాము");
    expect(exported).toContain("ABC0001");
    expect(exported).toContain("0012");
  });

  it("rejects formula cells and does not execute them", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const file = path.join(dir, "formula.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("voters");
    sheet.addRow(["name_original", "electoral_id"]);
    sheet.getCell("A2").value = "రాము";
    sheet.getCell("B2").value = { formula: "1+1", result: 2 };
    await workbook.xlsx.writeFile(file);
    const table = await readTabularFile(file);
    expect(table.formulaCellCount).toBeGreaterThan(0);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "formula edition"
    });
    const preview = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "formula.xlsx",
      sha: sha256File(file)
    });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id" });
    const validated = await validateSession(db, preview.sessionId);
    expect(validated.issues.some((issue) => issue.message.includes("formula"))).toBe(true);
    expect(() => commitImport(db, preview.sessionId)).toThrow(/identifier review|Resolve row-level/);
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).total).toBe(0);
  });

  it("flags missing identifiers, invalid wards, and does not infer wards from address", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const csv = writeCsv(
      dir,
      "bad.csv",
      `name_original,electoral_id,published_address,ward_number\n,,Some address,99\nలక్ష్మి,XYZ1,Ward 1 house,\n`
    );
    const table = await readTabularFile(csv);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "bad"
    });
    const preview = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "bad.csv",
      sha: sha256File(csv)
    });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, {
      nameOriginal: "name_original",
      electoralId: "electoral_id",
      publishedAddress: "published_address",
      wardNumber: "ward_number"
    });
    const validated = await validateSession(db, preview.sessionId);
    expect(validated.issues.some((issue) => issue.message.includes("name or an electoral identifier"))).toBe(true);
    expect(validated.issues.some((issue) => issue.message.includes("not in the selected constituency coverage"))).toBe(true);
    const lakshmi = validated.rows.find((row) => row.values.nameOriginal === "లక్ష్మి");
    expect(lakshmi?.assignedWardId).toBeNull();
    expect(lakshmi?.wardMatch).toBe("unassigned");
  });

  it("treats the same file in the same edition as a repeat and preserves a later revision separately", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const csv = writeCsv(dir, "once.csv", `name_original,electoral_id\nరాము,ABC0001\n`);
    const table = await readTabularFile(csv);
    const first = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "Revision 1",
      revisionCode: "r1"
    });
    const second = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "Revision 2",
      revisionCode: "r2"
    });
    const sha = sha256File(csv);
    const session1 = createSession(db, { constituencyId: geo.constituency.id, ...table, fileName: "once.csv", sha });
    setEdition(db, session1.sessionId, first.id);
    setMapping(session1.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id" });
    await validateSession(db, session1.sessionId);
    commitImport(db, session1.sessionId);
    const session2 = createSession(db, { constituencyId: geo.constituency.id, ...table, fileName: "once.csv", sha });
    const previewRepeat = setEdition(db, session2.sessionId, first.id);
    expect(previewRepeat.repeatedImport).toBe(true);
    setMapping(session2.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id" });
    await validateSession(db, session2.sessionId);
    expect(() => commitImport(db, session2.sessionId, false)).toThrow(/already imported/);
    const session3 = createSession(db, { constituencyId: geo.constituency.id, ...table, fileName: "once.csv", sha });
    const otherEdition = setEdition(db, session3.sessionId, second.id);
    expect(otherEdition.repeatedImport).toBe(false);
    setMapping(session3.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id" });
    await validateSession(db, session3.sessionId);
    commitImport(db, session3.sessionId);
    expect(editionCounts(db, geo.constituency.id, first.id).total).toBe(1);
    expect(editionCounts(db, geo.constituency.id, second.id).total).toBe(1);
  });

  it("isolates constituencies and rolls back a failed commit without partial rows", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const csv = writeCsv(dir, "iso.csv", `name_original,electoral_id,ward_number\nరాము,ABC0001,1\n`);
    const table = await readTabularFile(csv);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "iso"
    });
    const otherEdition = createEdition(db, {
      constituencyId: geo.other.id,
      boundaryVersionId: geo.version.id,
      name: "other"
    });
    expect(() =>
      createVoter(db, {
        constituencyId: geo.other.id,
        rollEditionId: edition.id,
        sourceName: "x",
        sourceElectoralId: "1"
      })
    ).toThrow(/constituency/);
    const session = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "iso.csv",
      sha: sha256File(csv)
    });
    expect(() => setEdition(db, session.sessionId, otherEdition.id)).toThrow(/constituency/);
    setEdition(db, session.sessionId, edition.id);
    setMapping(session.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id", wardNumber: "ward_number" });
    await validateSession(db, session.sessionId);
    getSession(session.sessionId).staged[0]!.assignedWardId = "missing-ward";
    expect(() => commitImport(db, session.sessionId)).toThrow();
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).total).toBe(0);
    const batches = db.prepare("SELECT COUNT(*) AS c FROM import_batches").get() as { c: number };
    expect(batches.c).toBe(0);
  });

  it("cancels staging without writing rows", async () => {
    const db = openMemory();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "cancel"
    });
    const session = createSession(db, {
      constituencyId: geo.constituency.id,
      columns: ["name_original"],
      rows: [["రాము"]],
      fileName: "x.csv",
      sha: "abc"
    });
    setEdition(db, session.sessionId, edition.id);
    setMapping(session.sessionId, { nameOriginal: "name_original" });
    await validateSession(db, session.sessionId);
    cancelImport(session.sessionId);
    expect(() => commitImport(db, session.sessionId)).toThrow(/no longer available/);
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).total).toBe(0);
  });

  it("flags duplicates inside one edition only and never merges them", () => {
    const db = openMemory();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "dupes"
    });
    const later = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "later"
    });
    createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "రాము",
      sourceElectoralId: "ABC0001",
      sourceAddress: "Same"
    });
    createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "రాము",
      sourceElectoralId: "ABC0001",
      sourceAddress: "Same"
    });
    createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: later.id,
      sourceName: "రాము",
      sourceElectoralId: "ABC0001",
      sourceAddress: "Same"
    });
    expect(flagDuplicatesForEdition(db, edition.id)).toBe(1);
    expect(flagDuplicatesForEdition(db, later.id)).toBe(0);
    const flagged = findDuplicates(db, geo.constituency.id, edition.id);
    expect(flagged.length).toBe(1);
    expect(flagged[0]?.reasons.some((reason) => reason.includes("electoral identifier"))).toBe(true);
    expect(flagged[0]?.reasons.some((reason) => reason.includes("review hint"))).toBe(true);
    expect(findDuplicates(db, geo.constituency.id, later.id)).toHaveLength(0);
    reviewDuplicate(db, { id: flagged[0]!.id, constituencyId: geo.constituency.id, status: "distinct" });
    expect(findDuplicates(db, geo.constituency.id, edition.id)[0]?.status).toBe("distinct");
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).total).toBe(2);
  });

  it("guards spreadsheet injection on export and excludes archived records by default", () => {
    expect(guardSpreadsheetCell("=CMD()")).toBe("'=CMD()");
    const db = openMemory();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "export"
    });
    const live = createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "=1+1",
      sourceElectoralId: "0007"
    });
    const archived = createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "gone",
      sourceElectoralId: "0008"
    });
    archiveVoter(db, archived.id, geo.constituency.id, "source correction");
    const active = listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id });
    expect(active.total).toBe(1);
    const csv = exportVotersCsv(active.items, ["displayName", "displayElectoralId"]);
    expect(csv).toContain("'=1+1");
    expect(csv).not.toContain("gone");
    const withArchived = listVoters(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      includeArchived: true
    });
    expect(withArchived.total).toBe(2);
    expect(live.sourceElectoralId).toBe("0007");
  });

  it("does not auto-link persons to electoral-roll entries", () => {
    const db = openMemory();
    const geo = seed(db);
    createPerson(db, { name: "రాము", consentStatus: "unknown" });
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "unlink"
    });
    createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "రాము",
      sourceElectoralId: "P1"
    });
    const cols = db.prepare("PRAGMA table_info(voter_entries)").all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === "person_id")).toBe(false);
    const people = db.prepare("SELECT COUNT(*) AS c FROM persons").get() as { c: number };
    expect(people.c).toBe(1);
  });

  it("round-trips imported records through backup/restore", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3b-"));
    dirs.push(dir);
    const manager = new DatabaseManager(resolveDataPaths(dir));
    const db = manager.open();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "backed"
    });
    createVoter(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "రాము",
      sourceElectoralId: "0001",
      assignedWardId: geo.rural.id
    });
    const backupPath = path.join(dir, "copy.winwinbak");
    const backup = await createBackup(manager, backupPath);
    createVoter(manager.get(), {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      sourceName: "temp",
      sourceElectoralId: "9999"
    });
    await restoreBackup(manager, backup.path, { skipConfirm: true });
    const listed = listVoters(manager.get(), { constituencyId: geo.constituency.id, rollEditionId: edition.id });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.displayElectoralId).toBe("0001");
    expect(listed.items[0]?.displayName).toBe("రాము");
    manager.close();
  });

  it("documents import limits and ships a Telugu template", () => {
    expect(IMPORT_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(IMPORT_MAX_ROWS).toBe(50_000);
    expect(templateCsv()).toContain("రాము");
    expect(templateCsv()).toContain("ABC0001");
  });

  it("rejects files that are not csv or xlsx", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const file = path.join(dir, "roll.pdf");
    fs.writeFileSync(file, "%PDF");
    await expect(readTabularFile(file)).rejects.toThrow(/csv or .xlsx/i);
  });

  it("allows explicit bulk assignment of selected staged rows after invalid mapping", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const csv = writeCsv(dir, "map.csv", `name_original,electoral_id,ward_number\nరాము,A1,99\n`);
    const table = await readTabularFile(csv);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "map"
    });
    const session = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "map.csv",
      sha: sha256File(csv)
    });
    setEdition(db, session.sessionId, edition.id);
    setMapping(session.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id", wardNumber: "ward_number" });
    const validated = await validateSession(db, session.sessionId);
    expect(validated.ambiguousCount).toBe(1);
    const next = assignStagedWards(db, session.sessionId, [validated.rows[0]!.sourceRowNumber], geo.rural2.id);
    expect(next.assignedCount).toBe(1);
    const committed = commitImport(db, session.sessionId);
    expect(committed.imported).toBe(1);
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).items[0]?.assignedWardId).toBe(
      geo.rural2.id
    );
  });

  it("blocks commit when no rows are importable and refreshes eligibility after keep unassigned", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p3-"));
    dirs.push(dir);
    const csv = writeCsv(dir, "blocked.csv", `name_original,electoral_id,ward_number\nరాము,A1,99\n`);
    const table = await readTabularFile(csv);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "blocked"
    });
    const session = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "blocked.csv",
      sha: sha256File(csv)
    });
    setEdition(db, session.sessionId, edition.id);
    setMapping(session.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id", wardNumber: "ward_number" });
    const validated = await validateSession(db, session.sessionId);
    expect(validated.eligibleCount).toBe(0);
    expect(validated.excludedCount).toBe(1);
    expect(() => commitImport(db, session.sessionId)).toThrow(/No importable rows/);
    const kept = assignStagedWards(db, session.sessionId, [validated.rows[0]!.sourceRowNumber], null);
    expect(kept.eligibleCount).toBe(1);
    expect(kept.excludedCount).toBe(0);
    expect(kept.unassignedCount).toBe(1);
    const committed = commitImport(db, session.sessionId);
    expect(committed.imported).toBe(1);
    expect(committed.unassigned).toBe(1);
  });
});
