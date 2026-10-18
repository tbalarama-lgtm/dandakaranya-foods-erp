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
import { findWardsByNumber } from "./scope";
import { flagDuplicatesForEdition, getEdition } from "./voters";

export interface ImportSession {
  id: string;
  constituencyId: string;
  fileName: string;
  fileSha256: string;
  columns: string[];
  rows: string[][];
  mapping: ImportColumnMapping;
  rollEditionId: string | null;
  staged: StagedImportRow[];
  cancelled: boolean;
}

const sessions = new Map<string, ImportSession>();

export function cellToText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const rec = value as { formula?: string; result?: unknown; text?: string; richText?: Array<{ text: string }> };
    if (rec.formula) {
      if (rec.result != null) return cellToText(rec.result);
      return "";
    }
    if (typeof rec.text === "string") return rec.text;
    if (Array.isArray(rec.richText)) return rec.richText.map((p) => p.text).join("");
  }
  return String(value);
}

export async function readTabularFile(filePath: string): Promise<{ columns: string[]; rows: string[][] }> {
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
    return { columns, rows };
  }
  if (ext === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    if (workbook.definedNames?.model?.length) {
      /* ignore external defined names; never follow links */
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError("invalid_import", "The workbook has no worksheets.");
    const table: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      const cellCount = Math.max(row.cellCount, 1);
      for (let i = 1; i <= cellCount; i += 1) {
        values.push(cellToText(row.getCell(i).value));
      }
      table.push(values);
    });
    if (table.length === 0) throw new AppError("invalid_import", "The worksheet is empty.");
    const columns = table[0]!.map((c, i) => c.trim() || `column_${i + 1}`);
    const rows = table.slice(1);
    if (rows.length > IMPORT_MAX_ROWS) {
      throw new AppError("import_too_large", `File has ${rows.length} data rows; the limit is ${IMPORT_MAX_ROWS}.`);
    }
    return { columns, rows };
  }
  throw new AppError("invalid_import", "Use a .csv or .xlsx file. PDF/OCR import is not available in this phase.");
}

export function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function createSession(
  db: Database.Database,
  input: { constituencyId: string; filePath: string; columns: string[]; rows: string[][]; fileName: string; sha: string }
): ImportPreview {
  const previous = db
    .prepare(
      `SELECT id FROM import_batches WHERE file_sha256 = ? AND constituency_id = ? AND status = 'committed' ORDER BY created_at DESC LIMIT 1`
    )
    .get(input.sha, input.constituencyId) as { id: string } | undefined;
  const session: ImportSession = {
    id: newId(),
    constituencyId: input.constituencyId,
    fileName: input.fileName,
    fileSha256: input.sha,
    columns: input.columns,
    rows: input.rows,
    mapping: {},
    rollEditionId: null,
    staged: [],
    cancelled: false
  };
  sessions.set(session.id, session);
  return {
    sessionId: session.id,
    fileName: session.fileName,
    fileSha256: session.fileSha256,
    columns: session.columns,
    previewRows: session.rows.slice(0, 8),
    rowCount: session.rows.length,
    repeatedImport: Boolean(previous),
    previousBatchId: previous?.id ?? null
  };
}

function getSession(id: string): ImportSession {
  const session = sessions.get(id);
  if (!session || session.cancelled) throw new AppError("import_cancelled", "This import session is no longer available.");
  return session;
}

export function cancelImport(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) session.cancelled = true;
  sessions.delete(sessionId);
}

export function setEdition(sessionId: string, rollEditionId: string): void {
  getSession(sessionId).rollEditionId = rollEditionId;
}

export function setMapping(sessionId: string, mapping: ImportColumnMapping): void {
  getSession(sessionId).mapping = mapping;
}

function mapped(row: string[], columns: string[], column?: string): string {
  if (!column) return "";
  const idx = columns.indexOf(column);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
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
  session.rows.forEach((row, index) => {
    const sourceRowNumber = index + 2;
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
    unassignedCount: staged.filter((r) => r.wardMatch === "unassigned").length,
    ambiguousCount: staged.filter((r) => r.wardMatch === "ambiguous" || r.wardMatch === "invalid").length,
    assignedCount: staged.filter((r) => r.wardMatch === "assigned").length,
    issues
  };
}

export function assignStagedWards(sessionId: string, sourceRowNumbers: number[], wardId: string | null): void {
  const session = getSession(sessionId);
  const selected = new Set(sourceRowNumbers);
  for (const row of session.staged) {
    if (!selected.has(row.sourceRowNumber)) continue;
    row.assignedWardId = wardId;
    row.wardMatch = wardId ? "assigned" : "unassigned";
    row.errors = row.errors.filter((e) => !e.startsWith("Ward number"));
  }
}

export function commitImport(db: Database.Database, sessionId: string): ImportCommitResult {
  const session = getSession(sessionId);
  if (!session.rollEditionId) throw new AppError("validation", "Select a roll edition.");
  if (session.staged.length === 0) throw new AppError("validation", "Validate the file before importing.");
  const blocking = session.staged.filter((r) => r.errors.some((e) => e.startsWith("Row needs")));
  if (blocking.length) {
    throw new AppError("import_invalid", "Resolve row-level validation errors before commit. No records were imported.");
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
      "INSERT INTO ward_assignment_history (id, voter_id, from_ward_id, to_ward_id, reason, changed_at) VALUES (?, ?, NULL, ?, 'import', ?)"
    );
    for (const row of session.staged) {
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
    sessions.delete(sessionId);
    return { imported: session.staged.length, batchId, flaggedDuplicates };
  } catch (error) {
    db.prepare("UPDATE import_batches SET status = 'failed' WHERE id = ?").run(batchId);
    throw error instanceof AppError
      ? error
      : new AppError("import_failed", "Import rolled back. No voter records from this file were saved.");
  }
}

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
