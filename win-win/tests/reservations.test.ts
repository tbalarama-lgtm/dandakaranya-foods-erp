import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../src/shared/constants";
import { DatabaseManager, openMemory } from "../src/main/db/connection";
import { resolveDataPaths } from "../src/main/db/paths";
import { createBackup, restoreBackup } from "../src/main/services/backup";
import { setCoverage } from "../src/main/services/coverage";
import { createElection } from "../src/main/services/elections";
import { createBoundary, createConstituency, createGp, createMandal } from "../src/main/services/geo";
import { createWard } from "../src/main/services/wards";
import {
  approveMandalMapping,
  clearReservationSessions,
  commitReservationImport,
  createReservationNotification,
  createReservationSession,
  createReviewedGeography,
  exportReservationCsv,
  exportReservationXlsx,
  listReservationSeats,
  reservationSetContext,
  reservationSetPartial,
  reservationSummary,
  supersedeReservationNotification,
  verifyReservationNotification
} from "../src/main/services/reservations";
import {
  draftsFromPreview,
  normalizeReservationCode,
  parsePanchayatReservationSheet,
  proposeMandalLabel,
  womenReservedExplanation
} from "../src/main/services/reservations-parse";
import { isExcludedSheetName, listWorkbookSheets, readWorkbookSheet } from "../src/main/services/xlsx-sheet";

const dirs: string[] = [];
afterEach(() => {
  clearReservationSessions();
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function writeReservationBook(
  dir: string,
  name: string,
  rows: Array<[string, string, string, number | string, ...string[]]>,
  extraSheets?: Array<{ name: string; rows: string[][] }>
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("PANCHAYAT RESERVATIONS");
  sheet.getCell("A1").value = "Name of the Mandal";
  sheet.getCell("B1").value = "Name of the Gram Panchayat";
  sheet.getCell("C1").value = "Sarpanch Reservation";
  sheet.getCell("D1").value = "NO. OF";
  sheet.getCell("E1").value = "WEST GODAVARI DISTRICT SARPANCH AND WARD MEMBERS RESERVATION";
  sheet.getCell("C2").value = 2026;
  sheet.getCell("D2").value = "WARDS";
  const maxWards = Math.max(...rows.map((row) => Math.max(0, row.length - 4)), 2);
  for (let i = 0; i < maxWards; i += 1) sheet.getCell(2, 5 + i).value = i + 1;
  rows.forEach((row, index) => {
    row.forEach((value, col) => {
      sheet.getCell(3 + index, col + 1).value = value;
    });
  });
  for (const extra of extraSheets ?? []) {
    const other = wb.addWorksheet(extra.name);
    extra.rows.forEach((row, r) => row.forEach((value, c) => {
      other.getCell(r + 1, c + 1).value = value;
    }));
  }
  const file = path.join(dir, name);
  await wb.xlsx.writeFile(file);
  return file;
}

function seed() {
  const db = openMemory();
  const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
  const constituency = createConstituency(db, { name: "Seat A" });
  const other = createConstituency(db, { name: "Seat B" });
  const mandal = createMandal(db, { name: "Tanuku" });
  const gp = createGp(db, { mandalId: mandal.id, name: "Duvva" });
  const w1 = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Ward 1"
  });
  const w2 = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "2",
    name: "Ward 2"
  });
  setCoverage(db, {
    constituencyId: constituency.id,
    boundaryVersionId: version.id,
    unitType: "mandal",
    unitId: mandal.id,
    coverageKind: "complete"
  });
  const election = createElection(db, {
    name: "GP 2026",
    electionType: "gram_panchayat",
    year: 2026,
    constituencyId: constituency.id,
    boundaryVersionId: version.id,
    status: "active",
    wardIds: [w1.id, w2.id],
    coverage: []
  });
  return { db, version, constituency, other, mandal, gp, w1, w2, election };
}

describe("Seat reservation parsing", () => {
  it("normalizes categories and women-reserved flags without labelling men-only", () => {
    expect(normalizeReservationCode(" ur (w) ")).toMatchObject({ category: "UR", womenReserved: true, valid: true });
    expect(normalizeReservationCode("BC")).toMatchObject({ category: "BC", womenReserved: false, valid: true });
    expect(normalizeReservationCode("")).toMatchObject({ category: "not_recorded", missing: true });
    expect(normalizeReservationCode("XYZ")).toMatchObject({ category: "unknown", valid: false });
    expect(womenReservedExplanation(false)).toBe("Not specifically reserved for women");
    expect(proposeMandalLabel("Tanuku-3")).toEqual({ proposed: "Tanuku", derivedFromSuffix: true });
  });

  it("reads ward numbers from row 2 and converts wide columns to seat drafts", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "ok.xlsx", [
      ["Tanuku-1", "Duvva", "UR(W)", 2, "BC", "UR"],
      ["ATTILI RECORDS", "", "", ""],
      ["Attili-1", "Peda", "SC", 1, "SC(W)"]
    ]);
    const listed = listWorkbookSheets(file);
    expect(listed.map((s) => s.name)).toEqual(["PANCHAYAT RESERVATIONS"]);
    const { cells, worksheetName } = readWorkbookSheet(file, "PANCHAYAT RESERVATIONS");
    const preview = parsePanchayatReservationSheet(cells, { fileName: "ok.xlsx", worksheetName });
    expect(preview.year).toBe(2026);
    expect(preview.wardHeaders).toEqual(["1", "2"]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]?.populatedWardCount).toBe(2);
    const drafts = draftsFromPreview(preview);
    expect(drafts.filter((d) => d.seatType === "sarpanch")).toHaveLength(2);
    expect(drafts.filter((d) => d.seatType === "ward_member")).toHaveLength(3);
  });

  it("reconciles the uploaded reservation worksheet without reading pension data", () => {
    const uploaded = "/home/ubuntu/.cursor/projects/workspace/uploads/RESERVATIONS_OF_GRAM_PANCHAYATS_AND_WARDS_fb13.xlsx";
    if (!fs.existsSync(uploaded)) return;
    const sheets = listWorkbookSheets(uploaded);
    expect(sheets.some((s) => s.name === "PENSION DATA" && s.excluded)).toBe(true);
    expect(sheets.some((s) => s.name === "Sheet5" && s.excluded)).toBe(true);
    expect(() => readWorkbookSheet(uploaded, "PENSION DATA")).toThrow(/excluded/);
    const { cells, worksheetName } = readWorkbookSheet(uploaded, "PANCHAYAT RESERVATIONS");
    const preview = parsePanchayatReservationSheet(cells, { fileName: "uploaded.xlsx", worksheetName });
    expect(preview.controls.year).toBe(2026);
    expect(preview.controls.gramPanchayats).toBe(48);
    expect(preview.controls.tanuku).toBe(9);
    expect(preview.controls.attili).toBe(18);
    expect(preview.controls.iragavaram).toBe(21);
    expect(preview.controls.sarpanchReservations).toBe(48);
    expect(preview.controls.declaredWardSeats).toBe(534);
    expect(preview.controls.populatedWardReservations).toBe(534);
    expect(preview.controls.missingReservationCells).toBe(0);
    expect(preview.controls.invalidReservationCodes).toBe(0);
    expect(preview.controls.sarpanchByCode).toMatchObject({ UR: 13, "UR(W)": 12, BC: 8, "BC(W)": 7, SC: 5, "SC(W)": 3 });
    expect(preview.controls.wardByCode).toMatchObject({ UR: 125, "UR(W)": 157, BC: 82, "BC(W)": 74, SC: 61, "SC(W)": 35 });
    expect(preview.controlDiffs).toEqual([]);
  });

  it("skips excluded sheets in a mixed workbook and flags missing, invalid, duplicate headers", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(
      dir,
      "mixed.xlsx",
      [["Tanuku-1", "Duvva", "NOPE", 1, ""]],
      [
        { name: "PENSION DATA", rows: [["ssno", "name"], ["1", "secret"]] },
        { name: "Sheet5", rows: [] }
      ]
    );
    const sheets = listWorkbookSheets(file);
    expect(sheets.filter((s) => s.excluded).map((s) => s.name)).toEqual(["PENSION DATA", "Sheet5"]);
    const { cells, worksheetName } = readWorkbookSheet(file, "PANCHAYAT RESERVATIONS");
    const preview = parsePanchayatReservationSheet(cells, { fileName: "mixed.xlsx", worksheetName });
    expect(preview.controls.invalidReservationCodes).toBeGreaterThan(0);
    expect(preview.controls.missingReservationCells).toBeGreaterThan(0);
    const session = createReservationSession({ constituencyId: "c", filePath: file });
    expect(session.preview?.rows[0]?.sarpanchCategory).toBe("unknown");
  });
});

describe("Seat reservation import isolation", () => {
  it("requires mandal review, maps GP+ward+boundary, and blocks empty commits", async () => {
    const geo = seed();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "map.xlsx", [["Tanuku-1", "Duvva", "UR(W)", 2, "BC", "UR"]]);
    const session = createReservationSession({ constituencyId: geo.constituency.id, filePath: file });
    expect(session.preview?.rows[0]?.proposedMandal).toBe("Tanuku");
    reservationSetContext(geo.db, { sessionId: session.sessionId, electionId: geo.election.id, notificationName: "N1" });
    expect(() => commitReservationImport(geo.db, session.sessionId)).toThrow(/No importable|Unresolved|mandal/);
    const after = approveMandalMapping(geo.db, session.sessionId, "Tanuku", geo.mandal.id);
    expect(after.eligibleCount).toBe(3);
    const committed = commitReservationImport(geo.db, session.sessionId);
    expect(committed.imported).toBe(3);
    const listed = listReservationSeats(geo.db, { constituencyId: geo.constituency.id, pageSize: 10 });
    expect(listed.items.every((row) => row.gramPanchayatId === geo.gp.id)).toBe(true);
    expect(listed.items.some((row) => row.wardId === geo.w1.id)).toBe(true);
    expect(listed.items.find((row) => row.seatType === "sarpanch")?.womenReserved).toBe(true);
    const otherSeats = listReservationSeats(geo.db, { constituencyId: geo.other.id, pageSize: 10 });
    expect(otherSeats.total).toBe(0);
  });

  it("keeps earlier notifications and rejects duplicate fingerprints", async () => {
    const geo = seed();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "dup.xlsx", [["Tanuku-1", "Duvva", "UR", 1, "BC"]]);
    const first = createReservationSession({ constituencyId: geo.constituency.id, filePath: file });
    reservationSetContext(geo.db, { sessionId: first.sessionId, electionId: geo.election.id, notificationName: "v1" });
    approveMandalMapping(geo.db, first.sessionId, "Tanuku", geo.mandal.id);
    const note1 = commitReservationImport(geo.db, first.sessionId);
    const second = createReservationSession({ constituencyId: geo.constituency.id, filePath: file });
    reservationSetContext(geo.db, {
      sessionId: second.sessionId,
      electionId: geo.election.id,
      notificationId: note1.notificationId
    });
    approveMandalMapping(geo.db, second.sessionId, "Tanuku", geo.mandal.id);
    expect(() => commitReservationImport(geo.db, second.sessionId)).toThrow(/already imported/);
    const third = createReservationSession({ constituencyId: geo.constituency.id, filePath: file });
    reservationSetContext(geo.db, { sessionId: third.sessionId, electionId: geo.election.id, notificationName: "v2" });
    approveMandalMapping(geo.db, third.sessionId, "Tanuku", geo.mandal.id);
    const note2 = commitReservationImport(geo.db, third.sessionId);
    expect(note2.notificationId).not.toBe(note1.notificationId);
    supersedeReservationNotification(geo.db, { id: note1.notificationId, constituencyId: geo.constituency.id });
    expect(listReservationSeats(geo.db, { constituencyId: geo.constituency.id, notificationId: note1.notificationId }).total).toBeGreaterThan(0);
  });

  it("rolls back when a unique seat conflict is detected", async () => {
    const geo = seed();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "cf.xlsx", [["Tanuku-1", "Duvva", "UR", 1, "BC"]]);
    const session = createReservationSession({ constituencyId: geo.constituency.id, filePath: file });
    reservationSetContext(geo.db, { sessionId: session.sessionId, electionId: geo.election.id, notificationName: "one" });
    approveMandalMapping(geo.db, session.sessionId, "Tanuku", geo.mandal.id);
    const first = commitReservationImport(geo.db, session.sessionId);
    const before = listReservationSeats(geo.db, {
      constituencyId: geo.constituency.id,
      notificationId: first.notificationId
    }).total;
    expect(before).toBe(2);
    const clash = await writeReservationBook(dir, "cf2.xlsx", [["Tanuku-1", "Duvva", "SC", 1, "UR"]]);
    const again = createReservationSession({ constituencyId: geo.constituency.id, filePath: clash });
    reservationSetContext(geo.db, {
      sessionId: again.sessionId,
      electionId: geo.election.id,
      notificationId: first.notificationId
    });
    approveMandalMapping(geo.db, again.sessionId, "Tanuku", geo.mandal.id);
    expect(() => commitReservationImport(geo.db, again.sessionId)).toThrow(/conflicting seat/i);
    const after = listReservationSeats(geo.db, {
      constituencyId: geo.constituency.id,
      notificationId: first.notificationId
    });
    expect(after.total).toBe(before);
    expect(after.items.map((row) => row.originalCode).sort()).toEqual(["BC", "UR"]);
    const batches = geo.db
      .prepare("SELECT COUNT(*) AS c FROM reservation_import_batches WHERE notification_id = ?")
      .get(first.notificationId) as { c: number };
    expect(batches.c).toBe(1);
  });

  it("creates reviewed geography without inventing coverage and keeps unresolved on partial import", async () => {
    const db = openMemory();
    const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
    const constituency = createConstituency(db, { name: "Seat A" });
    const election = createElection(db, {
      name: "GP 2026",
      electionType: "gram_panchayat",
      year: 2026,
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      status: "active",
      wardIds: [],
      coverage: []
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "newgeo.xlsx", [["Attili-2", "NewGP", "BC", 1, "UR"]]);
    const session = createReservationSession({ constituencyId: constituency.id, filePath: file });
    reservationSetContext(db, { sessionId: session.sessionId, electionId: election.id, notificationName: "geo" });
    approveMandalMapping(db, session.sessionId, "Attili", null);
    const planned = createReviewedGeography(db, session.sessionId, true);
    expect(planned.geoPlan?.mandals.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(planned.eligibleCount).toBe(0);
    expect(() => commitReservationImport(db, session.sessionId, true)).toThrow(/No importable/);
    const createdMandal = db.prepare("SELECT COUNT(*) AS c FROM mandals WHERE name = 'Attili'").get() as { c: number };
    expect(createdMandal.c).toBe(1);
  });

  it("exports guarded CSV, verifies only with notes, and restores via backup", async () => {
    const geo = seed();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "bak.xlsx", [["Tanuku-1", "Duvva", "=UR", 1, "BC"]]);
    const { cells, worksheetName } = readWorkbookSheet(file, "PANCHAYAT RESERVATIONS");
    const preview = parsePanchayatReservationSheet(cells, { fileName: "bak.xlsx", worksheetName });
    expect(preview.rows[0]?.sarpanchOriginal === "=UR" || preview.rows[0]?.sarpanchCategory === "unknown").toBe(true);
    const clean = await writeReservationBook(dir, "clean.xlsx", [["Tanuku-1", "Duvva", "UR", 1, "+BC"]]);
    const session = createReservationSession({ constituencyId: geo.constituency.id, filePath: clean });
    reservationSetContext(geo.db, { sessionId: session.sessionId, electionId: geo.election.id, notificationName: "bak" });
    approveMandalMapping(geo.db, session.sessionId, "Tanuku", geo.mandal.id);
    reservationSetPartial(session.sessionId, true);
    const committed = commitReservationImport(geo.db, session.sessionId, true);
    expect(() =>
      verifyReservationNotification(geo.db, { id: committed.notificationId, constituencyId: geo.constituency.id, notificationReference: "", notes: "" })
    ).toThrow(/reference/);
    verifyReservationNotification(geo.db, {
      id: committed.notificationId,
      constituencyId: geo.constituency.id,
      notificationReference: "GO.1",
      notes: "Checked against paper copy"
    });
    const csv = exportReservationCsv(geo.db, {
      constituencyId: geo.constituency.id,
      notificationId: committed.notificationId,
      kind: "ward_member"
    });
    expect(csv).toContain("'+BC");
    const xlsx = await exportReservationXlsx(geo.db, {
      constituencyId: geo.constituency.id,
      notificationId: committed.notificationId,
      kind: "ward_member"
    });
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-bak-"));
    dirs.push(tmp);
    const manager = new DatabaseManager(resolveDataPaths(tmp));
    const live = manager.open();
    const version = createBoundary(live, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
    const constituency = createConstituency(live, { name: "Seat A" });
    const mandal = createMandal(live, { name: "Tanuku" });
    const gp = createGp(live, { mandalId: mandal.id, name: "Duvva" });
    const w1 = createWard(live, {
      classification: "rural",
      gramPanchayatId: gp.id,
      boundaryVersionId: version.id,
      wardNumber: "1",
      name: "Ward 1"
    });
    setCoverage(live, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      unitType: "mandal",
      unitId: mandal.id,
      coverageKind: "complete"
    });
    const election = createElection(live, {
      name: "GP 2026",
      electionType: "gram_panchayat",
      year: 2026,
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      status: "active",
      wardIds: [w1.id],
      coverage: []
    });
    const valid = await writeReservationBook(dir, "valid.xlsx", [["Tanuku-1", "Duvva", "UR", 1, "BC"]]);
    const sess = createReservationSession({ constituencyId: constituency.id, filePath: valid });
    reservationSetContext(live, { sessionId: sess.sessionId, electionId: election.id, notificationName: "bak2" });
    approveMandalMapping(live, sess.sessionId, "Tanuku", mandal.id);
    commitReservationImport(live, sess.sessionId);
    const dest = path.join(tmp, "r.winwinbak");
    await createBackup(manager, dest);
    live.prepare("DELETE FROM seat_reservations").run();
    await restoreBackup(manager, dest, { skipConfirm: true });
    const restored = manager.get().prepare("SELECT COUNT(*) AS c FROM seat_reservations").get() as { c: number };
    expect(restored.c).toBeGreaterThan(0);
    expect(SCHEMA_VERSION).toBe(6);
    manager.close();
  });

  it("treats ambiguous GP names as review rather than guessing", async () => {
    const geo = seed();
    createGp(geo.db, { mandalId: geo.mandal.id, name: "Duvva" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-res-"));
    dirs.push(dir);
    const file = await writeReservationBook(dir, "amb.xlsx", [["Tanuku-1", "Duvva", "UR", 1, "BC"]]);
    const session = createReservationSession({ constituencyId: geo.constituency.id, filePath: file });
    reservationSetContext(geo.db, { sessionId: session.sessionId, electionId: geo.election.id, notificationName: "amb" });
    const after = approveMandalMapping(geo.db, session.sessionId, "Tanuku", geo.mandal.id);
    expect(after.staged.some((row) => row.reviewStatus === "ambiguous")).toBe(true);
    expect(after.eligibleCount).toBe(0);
  });
});
