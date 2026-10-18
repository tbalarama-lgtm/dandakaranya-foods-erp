import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type Database from "better-sqlite3";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "@shared/constants";
import type {
  ImportColumnMapping,
  ImportCommitResult,
  ImportPreview,
  ImportValidateResult,
  ImportValidationIssue,
  StagedImportRow
} from "@shared/types";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { writeAudit } from "./audit";
import { parseCsv, stringifyCsv } from "./csv";
import { assertWardInConstituency, findWardsByNumber } from "./scope";
import { flagDuplicatesForEdition, getEdition } from "./voters";

interface CellRecord {
  text: string;
  formula: boolean;
  numericCoercion: boolean;
}

export interface ImportSession {
  id: string;
  constituencyId: string;
  fileName: string;
  fileSha256: string;
  columns: string[];
  rows: string[][];
  formulaMask: boolean[][];
  numericCoercionCount: number;
  formulaCellCount: number;
  mapping: ImportColumnMapping;
  rollEditionId: string | null;
  staged: StagedImportRow[];
  cancelled: boolean;
}

const sessions = new Map<string, ImportSession>();

export const TEMPLATE_HEADERS = [
  "name_original",
  "name_english",
  "electoral_id",
  "roll_serial",
  "published_age",
  "age_reference_date",
  "published_address",
  "ward_number",
  "source_section",
  "source_page"
];

const HEADER_ALIASES: Record<keyof ImportColumnMapping, string[]> = {
  nameOriginal: ["name_original", "name", "voter_name", "పేరు"],
  nameEnglish: ["name_english", "name_en", "english_name"],
  electoralId: ["electoral_id", "epic", "epic_no", "voter_id", "id"],
  rollSerial: ["roll_serial", "slno", "sl_no", "serial", "s_no"],
  publishedAge: ["published_age", "age"],
  ageReferenceDate: ["age_reference_date", "age_as_on", "reference_date"],
  publishedAddress: ["published_address", "address"],
  wardNumber: ["ward_number", "ward", "ward_no"],
  sourceSection: ["source_section", "section", "part"],
  sourcePage: ["source_page", "page"]
};

export function suggestMapping(columns: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  const normalized = columns.map((c) => c.trim().toLowerCase().replaceAll(/\s+/g, "_"));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof ImportColumnMapping, string[]]>) {
    const idx = normalized.findIndex((col) => aliases.includes(col));
    if (idx >= 0) mapping[field] = columns[idx];
  }
  return mapping;
}

export function cellToText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const rec = value as {
      formula?: string;
      sharedFormula?: string;
      result?: unknown;
      text?: string;
      richText?: Array<{ text: string }>;
      hyperlink?: string;
    };
    if (rec.formula || rec.sharedFormula) return "";
    if (typeof rec.text === "string") return rec.text;
    if (Array.isArray(rec.richText)) return rec.richText.map((p) => p.text).join("");
  }
  return String(value);
}

function readExcelCell(cell: ExcelJS.Cell): CellRecord {
  const value = cell.value;
  if (value && typeof value === "object") {
    const rec = value as { formula?: string; sharedFormula?: string };
    if (rec.formula || rec.sharedFormula) {
      return { text: "", formula: true, numericCoercion: false };
    }
  }
  if (typeof value === "number") {
    const displayed = String(cell.text ?? "").trim();
    if (displayed && displayed !== String(value) && !/^[=+\-@]/.test(displayed)) {
      return { text: displayed, formula: false, numericCoercion: false };
    }
    return { text: String(value), formula: false, numericCoercion: true };
  }
  return { text: cellToText(value), formula: false, numericCoercion: false };
}

export async function readTabularFile(filePath: string): Promise<{
  columns: string[];
  rows: string[][];
  formulaMask: boolean[][];
  formulaCellCount: number;
  numericCoercionCount: number;
}> {
  const stat = fs.statSync(filePath);
  if (stat.size > IMPORT_MAX_BYTES) {
    throw new AppError("import_too_large", `File exceeds the ${Math.round(IMPORT_MAX_BYTES / (1024 * 1024))} MB limit.`);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".txt") {
    const text = fs.readFileSync(filePath, "utf8");
    const table = parseCsv(text);
    if (table.length === 0) throw new AppError("invalid_import", "The CSV file is empty.");
    const columns = table[0]!.map((c) => c.trim() || "column");
    const rows = table.slice(1);
    if (rows.length > IMPORT_MAX_ROWS) {
      throw new AppError("import_too_large", `File has ${rows.length} data rows; the limit is ${IMPORT_MAX_ROWS}.`);
    }
    return {
      columns,
      rows,
      formulaMask: rows.map((row) => row.map(() => false)),
      formulaCellCount: 0,
      numericCoercionCount: 0
    };
  }
  if (ext === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError("invalid_import", "The workbook has no worksheets.");
    const table: string[][] = [];
    const formulaMask: boolean[][] = [];
    let formulaCellCount = 0;
    let numericCoercionCount = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      const formulas: boolean[] = [];
      const cellCount = Math.max(row.cellCount, 1);
      for (let i = 1; i <= cellCount; i += 1) {
        const parsed = readExcelCell(row.getCell(i));
        values.push(parsed.text);
        formulas.push(parsed.formula);
        if (parsed.formula) formulaCellCount += 1;
        if (parsed.numericCoercion) numericCoercionCount += 1;
      }
      table.push(values);
      formulaMask.push(formulas);
    });
    if (table.length === 0) throw new AppError("invalid_import", "The worksheet is empty.");
    const columns = table[0]!.map((c, i) => c.trim() || `column_${i + 1}`);
    const rows = table.slice(1);
    const rowMask = formulaMask.slice(1);
    if (rows.length > IMPORT_MAX_ROWS) {
      throw new AppError("import_too_large", `File has ${rows.length} data rows; the limit is ${IMPORT_MAX_ROWS}.`);
    }
    return { columns, rows, formulaMask: rowMask, formulaCellCount, numericCoercionCount };
  }
  throw new AppError("invalid_import", "Use a .csv or .xlsx file. PDF/OCR import is not available in this phase.");
}

export function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function findPreviousBatch(
  db: Database.Database,
  sha: string,
  constituencyId: string,
  rollEditionId: string | null
): { id: string } | undefined {
  if (!rollEditionId) return undefined;
  return db
    .prepare(
      `SELECT id FROM import_batches
       WHERE file_sha256 = ? AND constituency_id = ? AND roll_edition_id = ? AND status = 'committed'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(sha, constituencyId, rollEditionId) as { id: string } | undefined;
}

function toPreview(session: ImportSession, previousBatchId: string | null): ImportPreview {
  return {
    sessionId: session.id,
    fileName: session.fileName,
    fileSha256: session.fileSha256,
    columns: session.columns,
    previewRows: session.rows.slice(0, 8),
    rowCount: session.rows.length,
    formulaCellCount: session.formulaCellCount,
    numericCoercionCount: session.numericCoercionCount,
    suggestedMapping: suggestMapping(session.columns),
    repeatedImport: Boolean(previousBatchId),
    previousBatchId
  };
}

export function createSession(
  db: Database.Database,
  input: {
    constituencyId: string;
    columns: string[];
    rows: string[][];
    fileName: string;
    sha: string;
    formulaMask?: boolean[][];
    formulaCellCount?: number;
    numericCoercionCount?: number;
    rollEditionId?: string | null;
  }
): ImportPreview {
  const constituency = db.prepare("SELECT id FROM assembly_constituencies WHERE id = ?").get(input.constituencyId);
  if (!constituency) throw new AppError("not_found", "Constituency not found.");
  const session: ImportSession = {
    id: newId(),
    constituencyId: input.constituencyId,
    fileName: input.fileName,
    fileSha256: input.sha,
    columns: input.columns,
    rows: input.rows,
    formulaMask: input.formulaMask ?? input.rows.map((row) => row.map(() => false)),
    numericCoercionCount: input.numericCoercionCount ?? 0,
    formulaCellCount: input.formulaCellCount ?? 0,
    mapping: suggestMapping(input.columns),
    rollEditionId: input.rollEditionId ?? null,
    staged: [],
    cancelled: false
  };
  sessions.set(session.id, session);
  const previous = findPreviousBatch(db, session.fileSha256, session.constituencyId, session.rollEditionId);
  return toPreview(session, previous?.id ?? null);
}

export function getSession(id: string): ImportSession {
  const session = sessions.get(id);
  if (!session || session.cancelled) throw new AppError("import_cancelled", "This import session is no longer available.");
  return session;
}

export function cancelImport(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) session.cancelled = true;
  sessions.delete(sessionId);
}

export function clearImportSessions(): void {
  sessions.clear();
}

export function setEdition(db: Database.Database, sessionId: string, rollEditionId: string): ImportPreview {
  const session = getSession(sessionId);
  const edition = getEdition(db, rollEditionId);
  if (edition.constituencyId !== session.constituencyId) {
    throw new AppError("constituency_isolation", "The roll edition belongs to a different constituency.");
  }
  session.rollEditionId = rollEditionId;
  session.staged = [];
  const previous = findPreviousBatch(db, session.fileSha256, session.constituencyId, rollEditionId);
  return toPreview(session, previous?.id ?? null);
}

export function setMapping(sessionId: string, mapping: ImportColumnMapping): ImportColumnMapping {
  const session = getSession(sessionId);
  session.mapping = mapping;
  session.staged = [];
  return session.mapping;
}

function mapped(row: string[], columns: string[], column?: string): string {
  if (!column) return "";
  const idx = columns.indexOf(column);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

function mappedFormula(mask: boolean[], columns: string[], column?: string): boolean {
  if (!column) return false;
  const idx = columns.indexOf(column);
  if (idx < 0) return false;
  return Boolean(mask[idx]);
}

export function validateSession(db: Database.Database, sessionId: string): ImportValidateResult {
  const session = getSession(sessionId);
  if (!session.rollEditionId) throw new AppError("validation", "Select a roll edition before validating.");
  const edition = getEdition(db, session.rollEditionId);
  if (edition.constituencyId !== session.constituencyId) {
    throw new AppError("constituency_isolation", "The roll edition belongs to a different constituency.");
  }
  const issues: ImportValidationIssue[] = [];
  const staged: StagedImportRow[] = [];
  const fields: Array<keyof ImportColumnMapping> = [
    "nameOriginal",
    "nameEnglish",
    "electoralId",
    "rollSerial",
    "publishedAge",
    "ageReferenceDate",
    "publishedAddress",
    "wardNumber",
    "sourceSection",
    "sourcePage"
  ];
  session.rows.forEach((row, index) => {
    const sourceRowNumber = index + 2;
    const mask = session.formulaMask[index] ?? [];
    const empty = row.every((cell) => !String(cell ?? "").trim());
    if (empty) return;
    const values = {
      nameOriginal: mapped(row, session.columns, session.mapping.nameOriginal),
      nameEnglish: mapped(row, session.columns, session.mapping.nameEnglish),
      electoralId: mapped(row, session.columns, session.mapping.electoralId),
      rollSerial: mapped(row, session.columns, session.mapping.rollSerial),
      publishedAge: mapped(row, session.columns, session.mapping.publishedAge),
      ageReferenceDate: mapped(row, session.columns, session.mapping.ageReferenceDate),
      publishedAddress: mapped(row, session.columns, session.mapping.publishedAddress),
      wardNumber: mapped(row, session.columns, session.mapping.wardNumber),
      sourceSection: mapped(row, session.columns, session.mapping.sourceSection),
      sourcePage: mapped(row, session.columns, session.mapping.sourcePage)
    };
    const errors: string[] = [];
    for (const field of fields) {
      const column = session.mapping[field];
      if (mappedFormula(mask, session.columns, column)) {
        errors.push(`Column ${column} contains a spreadsheet formula. Enter a literal value; formulas are not executed or imported.`);
      }
    }
    if (!values.nameOriginal && !values.electoralId) {
      errors.push("Row needs a name or an electoral identifier. Empty rows cannot be imported.");
    }
    let wardMatch: StagedImportRow["wardMatch"] = "unassigned";
    let assignedWardId: string | null = null;
    let wardCandidates: Array<{ id: string; label: string }> = [];
    if (values.wardNumber) {
      wardCandidates = findWardsByNumber(db, session.constituencyId, edition.boundaryVersionId, values.wardNumber);
      if (wardCandidates.length === 1) {
        wardMatch = "assigned";
        assignedWardId = wardCandidates[0]!.id;
      } else if (wardCandidates.length > 1) {
        wardMatch = "ambiguous";
        errors.push(`Ward number ${values.wardNumber} matches more than one ward in this constituency. Do not guess.`);
      } else {
        wardMatch = "invalid";
        errors.push(`Ward number ${values.wardNumber} is not in the selected constituency coverage.`);
      }
    }
    for (const err of errors) {
      issues.push({ sourceRowNumber, field: "row", message: err });
    }
    staged.push({ sourceRowNumber, values, wardMatch, assignedWardId, wardCandidates, errors });
  });
  session.staged = staged;
  return {
    rows: staged,
    errorCount: issues.length,
    unassignedCount: staged.filter((r) => r.wardMatch === "unassigned" || (r.wardMatch !== "assigned" && !r.assignedWardId)).length,
    ambiguousCount: staged.filter((r) => r.wardMatch === "ambiguous" || r.wardMatch === "invalid").length,
    assignedCount: staged.filter((r) => r.wardMatch === "assigned").length,
    issues
  };
}

export function assignStagedWards(
  db: Database.Database,
  sessionId: string,
  sourceRowNumbers: number[],
  wardId: string | null
): ImportValidateResult {
  const session = getSession(sessionId);
  if (!session.rollEditionId) throw new AppError("validation", "Select a roll edition before assigning wards.");
  if (session.staged.length === 0) throw new AppError("validation", "Validate the file before assigning wards.");
  if (sourceRowNumbers.length === 0) throw new AppError("validation", "Select at least one row to assign.");
  const edition = getEdition(db, session.rollEditionId);
  if (wardId) {
    assertWardInConstituency(db, session.constituencyId, wardId, edition.boundaryVersionId);
  }
  const selected = new Set(sourceRowNumbers);
  for (const row of session.staged) {
    if (!selected.has(row.sourceRowNumber)) continue;
    row.assignedWardId = wardId;
    row.wardMatch = wardId ? "assigned" : "unassigned";
    row.errors = row.errors.filter((e) => !e.startsWith("Ward number") && !e.includes("matches more than one ward"));
  }
  const issues: ImportValidationIssue[] = session.staged.flatMap((row) =>
    row.errors.map((message) => ({ sourceRowNumber: row.sourceRowNumber, field: "row", message }))
  );
  return {
    rows: session.staged,
    errorCount: issues.length,
    unassignedCount: session.staged.filter((r) => !r.assignedWardId).length,
    ambiguousCount: session.staged.filter((r) => r.wardMatch === "ambiguous" || r.wardMatch === "invalid").length,
    assignedCount: session.staged.filter((r) => r.assignedWardId).length,
    issues
  };
}

function blockingErrors(row: StagedImportRow): string[] {
  return row.errors.filter(
    (e) =>
      e.startsWith("Row needs") ||
      e.includes("spreadsheet formula") ||
      (e.startsWith("Ward number") && row.assignedWardId == null && (row.wardMatch === "ambiguous" || row.wardMatch === "invalid"))
  );
}

export function commitImport(db: Database.Database, sessionId: string, acknowledgeRepeat = false): ImportCommitResult {
  const session = getSession(sessionId);
  if (!session.rollEditionId) throw new AppError("validation", "Select a roll edition.");
  if (session.staged.length === 0) throw new AppError("validation", "Validate the file before importing.");
  const blocking = session.staged.filter((r) => blockingErrors(r).length > 0);
  if (blocking.length) {
    throw new AppError("import_invalid", "Resolve row-level validation errors before commit. No records were imported.");
  }
  const previous = findPreviousBatch(db, session.fileSha256, session.constituencyId, session.rollEditionId);
  if (previous && !acknowledgeRepeat) {
    throw new AppError(
      "import_repeated",
      "This file was already imported into this roll edition. Confirm if you intend to import it again as additional rows."
    );
  }
  const edition = getEdition(db, session.rollEditionId);
  const batchId = newId();
  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO import_batches (id, constituency_id, roll_edition_id, file_name, file_sha256, row_count, status, mapping_json, created_at, committed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'committed', ?, ?, ?)`
    ).run(
      batchId,
      session.constituencyId,
      session.rollEditionId,
      session.fileName,
      session.fileSha256,
      session.staged.length,
      JSON.stringify(session.mapping),
      ts,
      ts
    );
    const insert = db.prepare(
      `INSERT INTO voter_entries (
        id, roll_edition_id, constituency_id, import_batch_id, source_row_number,
        source_name, source_name_en, source_electoral_id, source_roll_serial, source_age, source_age_reference_date,
        source_address, source_section, source_page, source_ward_label,
        assigned_ward_id, verification_status, verified_at, archived, archive_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', NULL, 0, '', ?, ?)`
    );
    const hist = db.prepare(
      "INSERT INTO ward_assignment_history (id, voter_id, from_ward_id, to_ward_id, reason, changed_at, verification_source) VALUES (?, ?, NULL, ?, 'import', ?, 'import-file')"
    );
    for (const row of session.staged) {
      if (row.assignedWardId) {
        assertWardInConstituency(db, session.constituencyId, row.assignedWardId, edition.boundaryVersionId);
      }
      const id = newId();
      insert.run(
        id,
        session.rollEditionId,
        session.constituencyId,
        batchId,
        row.sourceRowNumber,
        row.values.nameOriginal ?? "",
        row.values.nameEnglish ?? "",
        row.values.electoralId ?? "",
        row.values.rollSerial ?? "",
        row.values.publishedAge ?? "",
        row.values.ageReferenceDate ?? "",
        row.values.publishedAddress ?? "",
        row.values.sourceSection ?? "",
        row.values.sourcePage ?? "",
        row.values.wardNumber ?? "",
        row.assignedWardId,
        ts,
        ts
      );
      if (row.assignedWardId) hist.run(newId(), id, row.assignedWardId, ts);
    }
    writeAudit(db, {
      action: "create",
      entityType: "import_batch",
      recordId: batchId,
      changedFields: ["fileName", "rowCount", "rollEditionId"]
    });
    const flagged = flagDuplicatesForEdition(db, session.rollEditionId!);
    return flagged;
  });
  try {
    const flaggedDuplicates = tx();
    const unassigned = session.staged.filter((r) => !r.assignedWardId).length;
    const imported = session.staged.length;
    sessions.delete(sessionId);
    return { imported, batchId, flaggedDuplicates, unassigned };
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError("import_failed", "Import rolled back. No voter records from this file were saved.");
  }
}

export function templateCsv(): string {
  return stringifyCsv([
    TEMPLATE_HEADERS,
    ["రాము", "Ramu", "ABC0001", "0012", "42", "2026-01-01", "Demo address", "1", "12", "3"]
  ]);
}

export async function templateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("voters", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(TEMPLATE_HEADERS);
  sheet.addRow(["రాము", "Ramu", "ABC0001", "0012", "42", "2026-01-01", "Demo address", "1", "12", "3"]);
  for (let i = 1; i <= TEMPLATE_HEADERS.length; i += 1) {
    sheet.getColumn(i).numFmt = "@";
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function errorReportCsv(result: ImportValidateResult): string {
  return stringifyCsv([
    ["source_row_number", "field", "message"],
    ...result.issues.map((issue) => [String(issue.sourceRowNumber), issue.field, issue.message])
  ]);
}

export { sessions };
