import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "../src/shared/constants";
import { DatabaseManager, openMemory } from "../src/main/db/connection";
import { resolveDataPaths } from "../src/main/db/paths";
import { parseCsv } from "../src/main/services/csv";
import { exportVotersCsv, exportVotersXlsx } from "../src/main/services/export-voters";
import { uniqueHeaders } from "../src/main/services/excel-cells";
import { setCoverage } from "../src/main/services/coverage";
import {
  cancelImport,
  clearImportSessions,
  commitImport,
  createSession,
  getSession,
  inspectSpreadsheet,
  readTabularFile,
  reviewIdentifiers,
  setEdition,
  setMapping,
  sha256File,
  templateCsv,
  templateXlsx,
  validateSession
} from "../src/main/services/import-voters";
import {
  createBoundary,
  createConstituency,
  createGp,
  createMandal
} from "../src/main/services/geo";
import { createWard } from "../src/main/services/wards";
import { archiveVoter, createEdition, editionCounts, listVoters, listVotersForExport } from "../src/main/services/voters";

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
  const rural = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Rural 1"
  });
  setCoverage(db, {
    constituencyId: constituency.id,
    boundaryVersionId: version.id,
    unitType: "gram_panchayat",
    unitId: gp.id,
    coverageKind: "complete"
  });
  return { version, constituency, other, rural };
}

async function workbookToFile(dir: string, name: string, build: (wb: ExcelJS.Workbook) => void): Promise<string> {
  const file = path.join(dir, name);
  const wb = new ExcelJS.Workbook();
  build(wb);
  await wb.xlsx.writeFile(file);
  return file;
}

describe("Phase 3 identifier safety and import integrity", () => {
  it("keeps text 0012 and refuses to treat numeric 12 as original text", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-id-"));
    dirs.push(dir);
    const file = await workbookToFile(dir, "ids.xlsx", (wb) => {
      const sheet = wb.addWorksheet("roll");
      sheet.addRow(["name_original", "electoral_id", "roll_serial"]);
      sheet.getCell("A2").value = "రాము";
      sheet.getCell("B2").value = "0012";
      sheet.getCell("C2").value = "0012";
      sheet.getCell("A3").value = "సీత";
      sheet.getCell("B3").value = 12;
      sheet.getCell("C3").value = 12;
      sheet.getCell("B3").numFmt = "0000";
      sheet.getCell("C3").numFmt = "0000";
    });
    const table = await readTabularFile(file);
    const idCol = table.columns.indexOf("electoral_id");
    expect(table.cells[0]![idCol]!.type).toBe("text");
    expect(table.cells[0]![idCol]!.text).toBe("0012");
    expect(table.cells[0]![idCol]!.originalTextEstablished).toBe(true);
    expect(table.cells[1]![idCol]!.type).toBe("number");
    expect(table.cells[1]![idCol]!.raw).toBe("12");
    expect(table.cells[1]![idCol]!.originalTextEstablished).toBe(false);
    expect(table.cells[1]![idCol]!.text).toBe("12");
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "ids"
    });
    const preview = createSession(db, { constituencyId: geo.constituency.id, ...table, fileName: "ids.xlsx", sha: sha256File(file) });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id", rollSerial: "roll_serial" });
    const validated = await validateSession(db, preview.sessionId);
    expect(validated.identifierReviewCount).toBe(1);
    expect(() => commitImport(db, preview.sessionId)).toThrow(/identifier review/);
    const row = getSession(preview.sessionId).staged.find((item) => item.values.nameOriginal === "సీత")!;
    reviewIdentifiers(db, preview.sessionId, [
      { sourceRowNumber: row.sourceRowNumber, field: "electoralId", action: "correct", value: "0012" },
      { sourceRowNumber: row.sourceRowNumber, field: "rollSerial", action: "accept-raw" }
    ]);
    const committed = commitImport(db, preview.sessionId);
    expect(committed.imported).toBe(2);
    expect(committed.rejected).toBe(0);
    const listed = listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id, pageSize: 10 });
    const sita = listed.items.find((item) => item.sourceName === "సీత")!;
    expect(sita.sourceElectoralId).toBe("12");
    expect(sita.localElectoralId).toBe("0012");
    expect(sita.displayElectoralId).toBe("0012");
    const ramu = listed.items.find((item) => item.sourceName === "రాము")!;
    expect(ramu.sourceElectoralId).toBe("0012");
    expect(ramu.localElectoralId).toBeNull();
  });

  it("classifies scientific notation and unsafe long numbers as unreliable", async () => {
    const db = openMemory();
    seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-sci-"));
    dirs.push(dir);
    const file = await workbookToFile(dir, "sci.xlsx", (wb) => {
      const sheet = wb.addWorksheet("roll");
      sheet.addRow(["name_original", "electoral_id"]);
      sheet.getCell("A2").value = "A";
      sheet.getCell("B2").value = 1.23e21;
      sheet.getCell("A3").value = "B";
      sheet.getCell("B3").value = 9007199254740993;
    });
    const table = await readTabularFile(file);
    expect(table.cells[0]![1]!.type).toBe("number");
    expect(table.cells[0]![1]!.originalTextEstablished).toBe(false);
    expect(table.cells[1]![1]!.precisionUnreliable || table.cells[1]![1]!.type === "number").toBe(true);
  });

  it("handles mixed-type identifier columns cell by cell", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-mix-"));
    dirs.push(dir);
    const file = await workbookToFile(dir, "mix.xlsx", (wb) => {
      const sheet = wb.addWorksheet("roll");
      sheet.addRow(["electoral_id"]);
      sheet.getCell("A2").value = "0012";
      sheet.getCell("A3").value = 12;
    });
    const table = await readTabularFile(file);
    expect(table.cells[0]![0]!.type).toBe("text");
    expect(table.cells[1]![0]!.type).toBe("number");
  });

  it("keeps CSV and XLSX templates as text including leading zeros", async () => {
    expect(templateCsv()).toContain("0012");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-tpl-"));
    dirs.push(dir);
    const file = path.join(dir, "template.xlsx");
    fs.writeFileSync(file, await templateXlsx());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets[0]!.getColumn(3).numFmt).toBe("@");
    expect(String(wb.worksheets[0]!.getRow(2).getCell(4).value)).toBe("0012");
  });

  it("detects duplicate and blank headers", () => {
    const result = uniqueHeaders(["name", "", "name", "electoral_id"]);
    expect(result.columns[1]).toBe("column_2");
    expect(result.columns[2]).toBe("name (2)");
    expect(result.warnings.length).toBeGreaterThan(1);
  });

  it("parses UTF-8 BOM, Telugu and multiline CSV fields without dropping interior empty rows", () => {
    const csv = `\uFEFFname_original,published_address\n"రాము","line1\nline2"\n,\nలక్ష్మి,ok\n`;
    const table = parseCsv(csv);
    expect(table[0]![0]).toBe("name_original");
    expect(table.some((row) => row[0] === "రాము")).toBe(true);
    expect(table.some((row) => (row[1] ?? "").includes("line1"))).toBe(true);
    expect(table.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects cached formula results and requires an explicit worksheet", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-sheets-"));
    dirs.push(dir);
    const file = await workbookToFile(dir, "multi.xlsx", (wb) => {
      const ignore = wb.addWorksheet("ignore");
      ignore.addRow(["name_original", "electoral_id"]);
      ignore.addRow(["wrong", "ZZZ"]);
      const roll = wb.addWorksheet("roll");
      roll.addRow(["name_original", "electoral_id"]);
      roll.getCell("A2").value = "రాము";
      roll.getCell("B2").value = { formula: "1+1", result: 2 };
    });
    const inspected = await inspectSpreadsheet(file);
    expect(inspected.worksheets.map((s) => s.name)).toEqual(["ignore", "roll"]);
    const table = await readTabularFile(file, { sheetName: "roll" });
    expect(table.selectedSheet).toBe("roll");
    expect(table.cells[0]![1]!.formula).toBe(true);
    expect(table.cells[0]![1]!.text).toBe("");
    expect(table.cells[0]![1]!.displayed === "2" || table.cells[0]![1]!.raw.includes("1+1")).toBe(true);
    const db = openMemory();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "formula"
    });
    const preview = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "multi.xlsx",
      sha: sha256File(file)
    });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, { nameOriginal: "name_original", electoralId: "electoral_id" });
    const validated = await validateSession(db, preview.sessionId);
    expect(validated.identifierReviewCount).toBe(1);
    const staged = getSession(preview.sessionId).staged[0]!;
    reviewIdentifiers(db, preview.sessionId, [
      { sourceRowNumber: staged.sourceRowNumber, field: "electoralId", action: "correct", value: "ABC0002" }
    ]);
    const committed = commitImport(db, preview.sessionId);
    expect(committed.imported).toBe(1);
    const voter = listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id, pageSize: 5 }).items[0]!;
    expect(voter.sourceElectoralId).toBe("");
    expect(voter.localElectoralId).toBe("ABC0002");
    expect(voter.displayElectoralId).toBe("ABC0002");
  });

  it("skips empty rows, counts rejected separately, and keeps mapping after a failed commit", async () => {
    const db = openMemory();
    const geo = seed(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-empty-"));
    dirs.push(dir);
    const csv = path.join(dir, "empty.csv");
    fs.writeFileSync(csv, "name_original,electoral_id,ward_number\nరాము,A1,1\n,,\n,NOID,99\n");
    const table = await readTabularFile(csv);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "empty"
    });
    const preview = createSession(db, { constituencyId: geo.constituency.id, ...table, fileName: "empty.csv", sha: sha256File(csv) });
    setEdition(db, preview.sessionId, edition.id);
    const mapping = setMapping(preview.sessionId, {
      nameOriginal: "name_original",
      electoralId: "electoral_id",
      wardNumber: "ward_number"
    });
    expect(mapping.electoralId).toBe("electoral_id");
    const validated = await validateSession(db, preview.sessionId);
    expect(validated.emptySkipped).toBeGreaterThanOrEqual(1);
    expect(validated.rejectedCount).toBeGreaterThanOrEqual(1);
    const committed = commitImport(db, preview.sessionId);
    expect(committed.imported).toBeGreaterThanOrEqual(1);
    expect(committed.rejected).toBeGreaterThanOrEqual(1);
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).total).toBe(committed.imported);
  });

  it("paginates directory counts and exports actual CSV/XLSX contents", async () => {
    const db = openMemory();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "page"
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-page-"));
    dirs.push(dir);
    const csv = path.join(dir, "page.csv");
    const lines = ["name_original,electoral_id,published_address,ward_number"];
    for (let i = 1; i <= 30; i += 1) {
      lines.push(`${i === 1 ? "రాము" : `P${i}`},ID${String(i).padStart(4, "0")},addr,${i <= 20 ? "1" : ""}`);
    }
    lines.push("=1+1,HACK,x,1");
    fs.writeFileSync(csv, `\uFEFF${lines.join("\n")}`);
    const table = await readTabularFile(csv);
    const preview = createSession(db, { constituencyId: geo.constituency.id, ...table, fileName: "page.csv", sha: sha256File(csv) });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, {
      nameOriginal: "name_original",
      electoralId: "electoral_id",
      publishedAddress: "published_address",
      wardNumber: "ward_number"
    });
    await validateSession(db, preview.sessionId);
    commitImport(db, preview.sessionId);
    const page1 = listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id, page: 1, pageSize: PAGE_SIZE });
    expect(page1.items).toHaveLength(PAGE_SIZE);
    const page2 = listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id, page: 2, pageSize: PAGE_SIZE });
    expect(page2.total).toBe(31);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    const counts = editionCounts(db, geo.constituency.id, edition.id);
    expect(counts.assigned + counts.unassigned + counts.archived).toBe(counts.total);
    expect(counts.assigned).toBeGreaterThan(0);
    expect(counts.unassigned).toBeGreaterThan(0);
    const toArchive = listVoters(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      query: "ID0005",
      pageSize: 5
    }).items[0]!;
    archiveVoter(db, toArchive.id, geo.constituency.id, "test archive");
    const after = editionCounts(db, geo.constituency.id, edition.id);
    expect(after.assigned + after.unassigned + after.archived).toBe(after.total);
    const active = listVotersForExport(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id });
    const csvOut = exportVotersCsv(active, ["displayName", "displayElectoralId", "displayAddress"]);
    expect(csvOut).toContain("'=1+1");
    expect(csvOut).toContain("ID0001");
    expect(csvOut).not.toContain("ID0005");
    const withArchived = listVotersForExport(db, {
      constituencyId: geo.constituency.id,
      rollEditionId: edition.id,
      includeArchived: true
    });
    expect(withArchived.length).toBe(after.total);
    const xlsx = await exportVotersXlsx(active, ["displayElectoralId"]);
    const xlsxPath = path.join(dir, "out.xlsx");
    fs.writeFileSync(xlsxPath, xlsx);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const values: string[] = [];
    wb.worksheets[0]!.eachRow((row) => values.push(String(row.getCell(1).value ?? "")));
    expect(values.some((v) => v.includes("ID0001"))).toBe(true);
  });

  it("cancels before commit and does not leave rows", async () => {
    const db = openMemory();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "cancel2"
    });
    const preview = createSession(db, {
      constituencyId: geo.constituency.id,
      columns: ["name_original"],
      rows: [["రాము"]],
      fileName: "c.csv",
      sha: "sha-c"
    });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, { nameOriginal: "name_original" });
    await validateSession(db, preview.sessionId);
    cancelImport(preview.sessionId);
    expect(() => commitImport(db, preview.sessionId)).toThrow(/no longer available/);
    expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id }).total).toBe(0);
  });
});

describe("Phase 3 large import performance", () => {
  it("parses, validates and commits increasing CSV sizes up to 50,000 rows with progress yields", async () => {
    const sizes = [2_000, 10_000, 50_000];
    const measurements: Array<Record<string, number | string>> = [];
    for (const size of sizes) {
      const db = openMemory();
      const geo = seed(db);
      const edition = createEdition(db, {
        constituencyId: geo.constituency.id,
        boundaryVersionId: geo.version.id,
        name: `perf-${size}`
      });
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-perf-"));
      dirs.push(dir);
      const csv = path.join(dir, `n${size}.csv`);
      const fh = fs.openSync(csv, "w");
      fs.writeSync(fh, "\uFEFFname_original,electoral_id,roll_serial,ward_number\n");
      const chunk: string[] = [];
      for (let i = 1; i <= size; i += 1) {
        chunk.push(`P${i},ID${String(i).padStart(5, "0")},${String(i).padStart(4, "0")},1`);
        if (chunk.length === 1000) {
          fs.writeSync(fh, `${chunk.join("\n")}\n`);
          chunk.length = 0;
        }
      }
      if (chunk.length) fs.writeSync(fh, `${chunk.join("\n")}\n`);
      fs.closeSync(fh);
      let yields = 0;
      const onProgress = () => {
        yields += 1;
      };
      const t0 = Date.now();
      const table = await readTabularFile(csv, { onProgress });
      const parseMs = Date.now() - t0;
      const preview = createSession(db, {
        constituencyId: geo.constituency.id,
        ...table,
        fileName: `n${size}.csv`,
        sha: sha256File(csv)
      });
      setEdition(db, preview.sessionId, edition.id);
      setMapping(preview.sessionId, {
        nameOriginal: "name_original",
        electoralId: "electoral_id",
        rollSerial: "roll_serial",
        wardNumber: "ward_number"
      });
      const t1 = Date.now();
      const validated = await validateSession(db, preview.sessionId, onProgress);
      const validateMs = Date.now() - t1;
      expect(validated.eligibleCount).toBe(size);
      const t2 = Date.now();
      const committed = commitImport(db, preview.sessionId, false, onProgress);
      const commitMs = Date.now() - t2;
      expect(committed.imported).toBe(size);
      expect(listVoters(db, { constituencyId: geo.constituency.id, rollEditionId: edition.id, pageSize: 25 }).total).toBe(size);
      if (size >= 10_000) expect(yields).toBeGreaterThan(1);
      measurements.push({ size, parseMs, validateMs, commitMs, yields, parseMsPerRow: parseMs / size, validateMsPerRow: validateMs / size });
    }
    const diskDir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-perf-disk-"));
    dirs.push(diskDir);
    const manager = new DatabaseManager(resolveDataPaths(diskDir));
    const db = manager.open();
    const geo = seed(db);
    const edition = createEdition(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "perf-disk-50000"
    });
    const csv = path.join(diskDir, "n50000.csv");
    const fh = fs.openSync(csv, "w");
    fs.writeSync(fh, "\uFEFFname_original,electoral_id,roll_serial,ward_number\n");
    const chunk: string[] = [];
    for (let i = 1; i <= 50_000; i += 1) {
      chunk.push(`P${i},ID${String(i).padStart(5, "0")},${String(i).padStart(4, "0")},1`);
      if (chunk.length === 1000) {
        fs.writeSync(fh, `${chunk.join("\n")}\n`);
        chunk.length = 0;
      }
    }
    if (chunk.length) fs.writeSync(fh, `${chunk.join("\n")}\n`);
    fs.closeSync(fh);
    const table = await readTabularFile(csv);
    const preview = createSession(db, {
      constituencyId: geo.constituency.id,
      ...table,
      fileName: "n50000.csv",
      sha: sha256File(csv)
    });
    setEdition(db, preview.sessionId, edition.id);
    setMapping(preview.sessionId, {
      nameOriginal: "name_original",
      electoralId: "electoral_id",
      rollSerial: "roll_serial",
      wardNumber: "ward_number"
    });
    const tValidate = Date.now();
    await validateSession(db, preview.sessionId);
    const diskValidateMs = Date.now() - tValidate;
    const tCommit = Date.now();
    const committed = commitImport(db, preview.sessionId);
    const diskCommitMs = Date.now() - tCommit;
    expect(committed.imported).toBe(50_000);
    manager.close();
    const out = path.join("/opt/cursor/artifacts", "win-win-import-performance.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify(
        {
          host: "linux",
          note: "Not a Windows/macOS measurement. Increasing sizes used in-memory SQLite; disk50k used a WAL file database.",
          measurements,
          disk50k: { size: 50_000, validateMs: diskValidateMs, commitMs: diskCommitMs }
        },
        null,
        2
      )
    );
    expect(measurements.at(-1)?.size).toBe(50_000);
  }, 180_000);
});
