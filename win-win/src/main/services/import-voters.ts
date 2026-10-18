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
  ImportPreviewCell,
  ImportValidateResult,
  ImportValidationIssue,
  StagedImportRow
} from "@shared/types";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { writeAudit } from "./audit";
import { parseCsv, stringifyCsv } from "./csv";
import {
  classifyExcelCell,
  IDENTIFIER_FIELDS,
  type CellRecord,
  type IdentifierField,
  textCell,
  uniqueHeaders
} from "./excel-cells";
import { assertWardInConstituency, indexWardsByNumber } from "./scope";
import { flagDuplicatesForEdition, getEdition } from "./voters";
import { IMPORT_CHUNK, yieldToEventLoop } from "./yield";

export type ImportProgressFn = (progress: {
  phase: "read" | "validate" | "commit";
  processed: number;
  total: number;
  message: string;
}) => void;

export interface WorksheetInfo {
  name: string;
  hidden: boolean;
}

export interface ImportSession {
  id: string;
  constituencyId: string;
  filePath: string | null;
  fileName: string;
  fileSha256: string;
  worksheets: WorksheetInfo[];
  selectedSheet: string | null;
  columns: string[];
  headerWarnings: string[];
  rows: string[][];
  cells: CellRecord[][];
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

const MAP_FIELDS: Array<keyof ImportColumnMapping> = [
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

export function suggestMapping(columns: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  const normalized = columns.map((c) => c.trim().toLowerCase().replaceAll(/\s+/g, "_"));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof ImportColumnMapping, string[]]>) {
    const idx = normalized.findIndex((col) => aliases.includes(col.replaceAll(/\s+/g, "_")));
    if (idx >= 0) mapping[field] = columns[idx];
  }
  return mapping;
}

function assertNotCancelled(session: ImportSession): void {
  if (session.cancelled) throw new AppError("import_cancelled", "This import session is no longer available.");
}

export function cellToText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const rec = value as { formula?: string; sharedFormula?: string; text?: string; richText?: Array<{ text: string }> };
    if (rec.formula || rec.sharedFormula) return "";
    if (typeof rec.text === "string") return rec.text;
    if (Array.isArray(rec.richText)) return rec.richText.map((p) => p.text).join("");
  }
  return String(value);
}

function toPreviewCells(cells: CellRecord[][]): ImportPreviewCell[][] {
  return cells.slice(0, 8).map((row) =>
    row.map((cell) => ({
      text: cell.text,
      type: cell.type,
      raw: cell.raw,
      displayed: cell.displayed,
      originalTextEstablished: cell.originalTextEstablished,
      precisionUnreliable: cell.precisionUnreliable,
      formula: cell.formula
    }))
  );
}

function countNumeric(cells: CellRecord[][]): number {
  return cells.reduce((sum, row) => sum + row.filter((c) => c.type === "number").length, 0);
}

function countFormula(cells: CellRecord[][]): number {
  return cells.reduce((sum, row) => sum + row.filter((c) => c.formula).length, 0);
}

export async function inspectSpreadsheet(filePath: string): Promise<{ worksheets: WorksheetInfo[] }> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".txt") return { worksheets: [{ name: "CSV", hidden: false }] };
  if (ext !== ".xlsx") throw new AppError("invalid_import", "Use a .csv or .xlsx file. PDF/OCR import is not available in this phase.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  if (!workbook.worksheets.length) throw new AppError("invalid_import", "The workbook has no worksheets.");
  return {
    worksheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      hidden: sheet.state === "hidden" || sheet.state === "veryHidden"
    }))
  };
}

export async function readTabularFile(
  filePath: string,
  options: { sheetName?: string; onProgress?: ImportProgressFn; session?: ImportSession } = {}
): Promise<{
  columns: string[];
  rows: string[][];
  cells: CellRecord[][];
  formulaMask: boolean[][];
  formulaCellCount: number;
  numericCoercionCount: number;
  headerWarnings: string[];
  worksheets: WorksheetInfo[];
  selectedSheet: string;
}> {
  const stat = fs.statSync(filePath);
  if (stat.size > IMPORT_MAX_BYTES) {
    throw new AppError("import_too_large", `File exceeds the ${Math.round(IMPORT_MAX_BYTES / (1024 * 1024))} MB limit.`);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".txt") {
    options.onProgress?.({ phase: "read", processed: 0, total: 1, message: "Reading CSV…" });
    const text = fs.readFileSync(filePath, "utf8");
    const table = parseCsv(text);
    if (table.length === 0) throw new AppError("invalid_import", "The CSV file is empty.");
    const headers = uniqueHeaders(table[0]!.map((c) => c.trim()));
    const data = table.slice(1);
    if (data.length > IMPORT_MAX_ROWS) {
      throw new AppError("import_too_large", `File has ${data.length} data rows; the limit is ${IMPORT_MAX_ROWS}.`);
    }
    const cells: CellRecord[][] = [];
    for (let i = 0; i < data.length; i += 1) {
      if (options.session) assertNotCancelled(options.session);
      const padded = [...data[i]!];
      while (padded.length < headers.columns.length) padded.push("");
      cells.push(padded.slice(0, headers.columns.length).map((value) => textCell(value)));
      if ((i + 1) % IMPORT_CHUNK === 0) {
        options.onProgress?.({
          phase: "read",
          processed: i + 1,
          total: data.length,
          message: "Reading CSV…"
        });
        await yieldToEventLoop();
      }
    }
    const rows = cells.map((row) => row.map((cell) => cell.text));
    options.onProgress?.({ phase: "read", processed: rows.length, total: rows.length, message: "CSV read." });
    return {
      columns: headers.columns,
      rows,
      cells,
      formulaMask: cells.map((row) => row.map((cell) => cell.formula)),
      formulaCellCount: 0,
      numericCoercionCount: 0,
      headerWarnings: headers.warnings,
      worksheets: [{ name: "CSV", hidden: false }],
      selectedSheet: "CSV"
    };
  }
  if (ext === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheets: WorksheetInfo[] = workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      hidden: sheet.state === "hidden" || sheet.state === "veryHidden"
    }));
    if (!worksheets.length) throw new AppError("invalid_import", "The workbook has no worksheets.");
    const sheet =
      (options.sheetName ? workbook.worksheets.find((item) => item.name === options.sheetName) : workbook.worksheets[0]) ??
      null;
    if (!sheet) throw new AppError("invalid_import", "The selected worksheet was not found.");
    const rowCount = sheet.rowCount;
    if (rowCount < 1) throw new AppError("invalid_import", "The worksheet is empty.");
    if (rowCount - 1 > IMPORT_MAX_ROWS) {
      throw new AppError("import_too_large", `File has ${rowCount - 1} data rows; the limit is ${IMPORT_MAX_ROWS}.`);
    }
    const headerRow = sheet.getRow(1);
    const headerWidth = Math.max(headerRow.cellCount, 1);
    const rawHeaders: string[] = [];
    for (let i = 1; i <= headerWidth; i += 1) {
      rawHeaders.push(classifyExcelCell(headerRow.getCell(i)).text.trim());
    }
    const headers = uniqueHeaders(rawHeaders);
    const cells: CellRecord[][] = [];
    for (let r = 2; r <= rowCount; r += 1) {
      if (options.session) assertNotCancelled(options.session);
      const row = sheet.getRow(r);
      const record: CellRecord[] = [];
      for (let c = 1; c <= headerWidth; c += 1) {
        record.push(classifyExcelCell(row.getCell(c)));
      }
      cells.push(record);
      if ((r - 1) % IMPORT_CHUNK === 0) {
        options.onProgress?.({
          phase: "read",
          processed: r - 1,
          total: rowCount - 1,
          message: `Reading worksheet ${sheet.name}…`
        });
        await yieldToEventLoop();
      }
    }
    const rows = cells.map((row) => row.map((cell) => cell.text));
    options.onProgress?.({ phase: "read", processed: rows.length, total: rows.length, message: "Worksheet read." });
    return {
      columns: headers.columns,
      rows,
      cells,
      formulaMask: cells.map((row) => row.map((cell) => cell.formula)),
      formulaCellCount: countFormula(cells),
      numericCoercionCount: countNumeric(cells),
      headerWarnings: headers.warnings,
      worksheets,
      selectedSheet: sheet.name
    };
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

function findOtherEditionBatches(
  db: Database.Database,
  sha: string,
  constituencyId: string,
  rollEditionId: string | null
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM import_batches
       WHERE file_sha256 = ? AND constituency_id = ? AND status = 'committed'
         AND (? IS NULL OR roll_edition_id != ?)`
    )
    .get(sha, constituencyId, rollEditionId, rollEditionId) as { c: number };
  return Number(row.c ?? 0);
}

function emptyRowCount(cells: CellRecord[][]): number {
  return cells.filter((row) => row.every((cell) => !cell.text.trim() && !cell.formula)).length;
}

function toPreview(session: ImportSession, db: Database.Database): ImportPreview {
  const previous = findPreviousBatch(db, session.fileSha256, session.constituencyId, session.rollEditionId);
  const otherEditions = findOtherEditionBatches(db, session.fileSha256, session.constituencyId, session.rollEditionId);
  return {
    sessionId: session.id,
    fileName: session.fileName,
    fileSha256: session.fileSha256,
    columns: session.columns,
    previewRows: session.rows.slice(0, 8),
    previewCells: toPreviewCells(session.cells),
    rowCount: session.rows.length,
    emptyRowCount: emptyRowCount(session.cells),
    formulaCellCount: countFormula(session.cells),
    numericCoercionCount: countNumeric(session.cells),
    headerWarnings: session.headerWarnings,
    worksheets: session.worksheets,
    selectedSheet: session.selectedSheet,
    needsSheetSelection: session.worksheets.length > 1 && !session.selectedSheet,
    suggestedMapping: session.mapping,
    repeatedImport: Boolean(previous),
    previousBatchId: previous?.id ?? null,
    repeatedInOtherEditions: otherEditions > 0
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
    cells?: CellRecord[][];
    formulaMask?: boolean[][];
    formulaCellCount?: number;
    numericCoercionCount?: number;
    rollEditionId?: string | null;
    headerWarnings?: string[];
    worksheets?: WorksheetInfo[];
    selectedSheet?: string | null;
    filePath?: string | null;
    mapping?: ImportColumnMapping;
  }
): ImportPreview {
  const constituency = db.prepare("SELECT id FROM assembly_constituencies WHERE id = ?").get(input.constituencyId);
  if (!constituency) throw new AppError("not_found", "Constituency not found.");
  const cells =
    input.cells ??
    input.rows.map((row, r) =>
      row.map((value, c) => {
        const formula = Boolean(input.formulaMask?.[r]?.[c]);
        if (formula) {
          return {
            text: "",
            type: "formula" as const,
            raw: "",
            displayed: value,
            originalTextEstablished: false,
            precisionUnreliable: false,
            formula: true
          };
        }
        return textCell(value);
      })
    );
  const session: ImportSession = {
    id: newId(),
    constituencyId: input.constituencyId,
    filePath: input.filePath ?? null,
    fileName: input.fileName,
    fileSha256: input.sha,
    worksheets: input.worksheets ?? [{ name: "CSV", hidden: false }],
    selectedSheet: input.selectedSheet === undefined ? input.worksheets?.[0]?.name ?? "CSV" : input.selectedSheet,
    columns: input.columns,
    headerWarnings: input.headerWarnings ?? [],
    rows: input.rows.length ? input.rows : cells.map((row) => row.map((cell) => cell.text)),
    cells,
    mapping: input.mapping ?? suggestMapping(input.columns),
    rollEditionId: input.rollEditionId ?? null,
    staged: [],
    cancelled: false
  };
  sessions.set(session.id, session);
  return toPreview(session, db);
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

export async function selectSheet(
  db: Database.Database,
  sessionId: string,
  sheetName: string,
  onProgress?: ImportProgressFn
): Promise<ImportPreview> {
  const session = getSession(sessionId);
  if (!session.filePath) throw new AppError("invalid_import", "This session has no source file to re-read.");
  const table = await readTabularFile(session.filePath, { sheetName, onProgress, session });
  session.selectedSheet = table.selectedSheet;
  session.columns = table.columns;
  session.headerWarnings = table.headerWarnings;
  session.rows = table.rows;
  session.cells = table.cells;
  session.mapping = suggestMapping(table.columns);
  session.staged = [];
  return toPreview(session, db);
}

export function setEdition(db: Database.Database, sessionId: string, rollEditionId: string): ImportPreview {
  const session = getSession(sessionId);
  const edition = getEdition(db, rollEditionId);
  if (edition.constituencyId !== session.constituencyId) {
    throw new AppError("constituency_isolation", "The roll edition belongs to a different constituency.");
  }
  session.rollEditionId = rollEditionId;
  session.staged = [];
  return toPreview(session, db);
}

export function setMapping(sessionId: string, mapping: ImportColumnMapping): ImportColumnMapping {
  const session = getSession(sessionId);
  session.mapping = mapping;
  session.staged = [];
  return session.mapping;
}

function cellAt(session: ImportSession, rowIndex: number, column?: string): CellRecord | undefined {
  if (!column) return undefined;
  const idx = session.columns.indexOf(column);
  if (idx < 0) return undefined;
  return session.cells[rowIndex]?.[idx];
}

function mappedValue(session: ImportSession, rowIndex: number, column?: string): string {
  const cell = cellAt(session, rowIndex, column);
  return (cell?.text ?? "").trim();
}

function identifierMessage(field: IdentifierField, cell: CellRecord): string {
  const label = field === "electoralId" ? "Electoral identifier" : field === "rollSerial" ? "Roll serial" : "Ward number";
  if (cell.formula) {
    return `${label} is a formula (cached result ${cell.displayed || "empty"}). Enter a literal value; formulas are not imported.`;
  }
  if (cell.precisionUnreliable) {
    return `${label} is a numeric cell (${cell.raw}) that may have lost precision. Exact original text cannot be established. Do not invent digits. Review or correct it.`;
  }
  return `${label} came from a numeric cell (raw ${cell.raw}, displayed ${cell.displayed || "n/a"}). Leading zeros cannot be recovered. Accept the raw value or type the exact source text.`;
}

function summarize(session: ImportSession): ImportValidateResult {
  const staged = session.staged;
  const issues: ImportValidationIssue[] = staged.flatMap((row) =>
    row.errors.map((message) => ({ sourceRowNumber: row.sourceRowNumber, field: "row", message }))
  );
  const rejectedCount = staged.filter((row) => row.rejected).length;
  const eligible = staged.filter((row) => !row.empty && !row.rejected);
  return {
    rows: staged.filter((row) => !row.empty).slice(0, 100),
    rowsTruncated: staged.filter((row) => !row.empty).length > 100,
    errorCount: issues.length,
    issues: issues.slice(0, 200),
    assignedCount: eligible.filter((r) => r.assignedWardId).length,
    unassignedCount: eligible.filter((r) => !r.assignedWardId).length,
    ambiguousCount: staged.filter((r) => r.wardMatch === "ambiguous" || r.wardMatch === "invalid").length,
    rejectedCount,
    identifierReviewCount: staged.filter((r) => r.identifierReview === "needed").length,
    emptySkipped: staged.filter((r) => r.empty).length,
    eligibleCount: eligible.length
  };
}

export async function validateSession(
  db: Database.Database,
  sessionId: string,
  onProgress?: ImportProgressFn
): Promise<ImportValidateResult> {
  const session = getSession(sessionId);
  if (!session.rollEditionId) throw new AppError("validation", "Select a roll edition before validating.");
  const edition = getEdition(db, session.rollEditionId);
  if (edition.constituencyId !== session.constituencyId) {
    throw new AppError("constituency_isolation", "The roll edition belongs to a different constituency.");
  }
  const wardIndex = indexWardsByNumber(db, session.constituencyId, edition.boundaryVersionId);
  const staged: StagedImportRow[] = [];
  const total = session.cells.length;
  for (let index = 0; index < total; index += 1) {
    assertNotCancelled(session);
    const sourceRowNumber = index + 2;
    const rowCells = session.cells[index] ?? [];
    const empty = rowCells.every((cell) => !cell.text.trim() && !cell.formula);
    if (empty) {
      staged.push({
        sourceRowNumber,
        values: {
          nameOriginal: "",
          nameEnglish: "",
          electoralId: "",
          rollSerial: "",
          publishedAge: "",
          ageReferenceDate: "",
          publishedAddress: "",
          wardNumber: "",
          sourceSection: "",
          sourcePage: ""
        },
        wardMatch: "unassigned",
        assignedWardId: null,
        wardCandidates: [],
        errors: [],
        empty: true,
        rejected: false,
        identifierReview: "ok",
        corrections: {},
        reviewedFields: {},
        cellMeta: {}
      });
      continue;
    }
    const values: Record<string, string> = {
      nameOriginal: mappedValue(session, index, session.mapping.nameOriginal),
      nameEnglish: mappedValue(session, index, session.mapping.nameEnglish),
      electoralId: mappedValue(session, index, session.mapping.electoralId),
      rollSerial: mappedValue(session, index, session.mapping.rollSerial),
      publishedAge: mappedValue(session, index, session.mapping.publishedAge),
      ageReferenceDate: mappedValue(session, index, session.mapping.ageReferenceDate),
      publishedAddress: mappedValue(session, index, session.mapping.publishedAddress),
      wardNumber: mappedValue(session, index, session.mapping.wardNumber),
      sourceSection: mappedValue(session, index, session.mapping.sourceSection),
      sourcePage: mappedValue(session, index, session.mapping.sourcePage)
    };
    const errors: string[] = [];
    const cellMeta: StagedImportRow["cellMeta"] = {};
    let identifierReview: StagedImportRow["identifierReview"] = "ok";
    for (const field of MAP_FIELDS) {
      const column = session.mapping[field];
      const cell = cellAt(session, index, column);
      if (!cell || !column) continue;
      if (cell.formula) {
        errors.push(
          `Column ${column} contains a spreadsheet formula (cached result ${cell.displayed || "empty"}). Enter a literal value; formulas are not executed or imported.`
        );
      }
    }
    for (const field of IDENTIFIER_FIELDS) {
      const column = session.mapping[field];
      const cell = cellAt(session, index, column);
      if (!cell || cell.type === "empty") continue;
      cellMeta[field] = {
        type: cell.type,
        raw: cell.raw,
        displayed: cell.displayed,
        originalTextEstablished: cell.originalTextEstablished,
        precisionUnreliable: cell.precisionUnreliable
      };
      if (cell.formula || cell.type === "number" || !cell.originalTextEstablished) {
        identifierReview = "needed";
        errors.push(identifierMessage(field, cell));
      }
    }
    if (!values.nameOriginal && !values.electoralId) {
      errors.push("Row needs a name or an electoral identifier. Empty rows cannot be imported.");
    }
    let wardMatch: StagedImportRow["wardMatch"] = "unassigned";
    let assignedWardId: string | null = null;
    let wardCandidates: Array<{ id: string; label: string }> = [];
    if (values.wardNumber && identifierReview !== "needed") {
      wardCandidates = wardIndex.get(values.wardNumber) ?? [];
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
    const stagedRow: StagedImportRow = {
      sourceRowNumber,
      values,
      wardMatch,
      assignedWardId,
      wardCandidates,
      errors,
      empty: false,
      rejected: false,
      identifierReview,
      corrections: {},
      reviewedFields: {},
      cellMeta
    };
    refreshRejected(stagedRow);
    staged.push(stagedRow);
    if ((index + 1) % IMPORT_CHUNK === 0) {
      onProgress?.({ phase: "validate", processed: index + 1, total, message: "Validating rows…" });
      await yieldToEventLoop();
    }
  }
  session.staged = staged;
  onProgress?.({ phase: "validate", processed: total, total, message: "Validation finished." });
  return summarize(session);
}

export function listStaged(
  sessionId: string,
  input: { kind?: "review" | "identifier" | "rejected" | "unassigned" | "all"; page?: number; pageSize?: number }
): { items: StagedImportRow[]; total: number; page: number; pageSize: number } {
  const session = getSession(sessionId);
  const kind = input.kind ?? "review";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;
  let items = session.staged.filter((row) => !row.empty);
  if (kind === "identifier") items = items.filter((row) => row.identifierReview === "needed");
  else if (kind === "rejected") items = items.filter((row) => row.rejected);
  else if (kind === "unassigned") items = items.filter((row) => !row.assignedWardId && !row.rejected);
  else if (kind === "review") {
    items = items.filter(
      (row) => row.rejected || row.identifierReview === "needed" || row.wardMatch !== "assigned" || row.errors.length > 0
    );
  }
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

function identifierPrefix(field: IdentifierField): string {
  if (field === "electoralId") return "Electoral identifier";
  if (field === "rollSerial") return "Roll serial";
  return "Ward number";
}

export function reviewIdentifiers(
  db: Database.Database,
  sessionId: string,
  items: Array<{ sourceRowNumber: number; field: IdentifierField; action: "accept-raw" | "correct"; value?: string }>
): ImportValidateResult {
  const session = getSession(sessionId);
  if (session.staged.length === 0) throw new AppError("validation", "Validate the file before reviewing identifiers.");
  const byRow = new Map(session.staged.map((row) => [row.sourceRowNumber, row]));
  for (const item of items) {
    const row = byRow.get(item.sourceRowNumber);
    if (!row) continue;
    const meta = row.cellMeta[item.field];
    if (!meta) continue;
    if (item.action === "correct") {
      const value = item.value?.trim() ?? "";
      if (!value) throw new AppError("validation", "A correction cannot be empty. Type the exact source text or accept the raw value.");
      row.reviewedFields[item.field] = "corrected";
      row.corrections[item.field] = value;
      if (item.field === "wardNumber") row.values.wardNumber = value;
    } else {
      row.reviewedFields[item.field] = "accepted_raw";
      delete row.corrections[item.field];
      const accepted = meta.type === "formula" ? meta.displayed || meta.raw : meta.raw;
      row.values[item.field] = accepted;
    }
    const prefix = identifierPrefix(item.field);
    const column = session.mapping[item.field];
    row.errors = row.errors.filter(
      (err) =>
        !err.startsWith(prefix) &&
        !(column && err.startsWith(`Column ${column} contains a spreadsheet formula`))
    );
  }
  recomputeIdentifierAndWards(db, session);
  return summarize(session);
}

function fieldNeedsReview(meta: StagedImportRow["cellMeta"][string] | undefined): boolean {
  if (!meta) return false;
  return meta.type === "number" || meta.type === "formula" || !meta.originalTextEstablished;
}

function recomputeIdentifierAndWards(db: Database.Database, session: ImportSession): void {
  if (!session.rollEditionId) return;
  const edition = getEdition(db, session.rollEditionId);
  const wardIndex = indexWardsByNumber(db, session.constituencyId, edition.boundaryVersionId);
  for (const row of session.staged) {
    if (row.empty) continue;
    const pending = IDENTIFIER_FIELDS.filter((field) => fieldNeedsReview(row.cellMeta[field]) && !row.reviewedFields[field]);
    if (pending.length) row.identifierReview = "needed";
    else if (Object.values(row.reviewedFields).includes("corrected")) row.identifierReview = "corrected";
    else if (Object.keys(row.reviewedFields).length) row.identifierReview = "accepted_raw";
    else row.identifierReview = "ok";
    if (row.identifierReview !== "needed") {
      const wardKey = row.values.wardNumber;
      if (wardKey) {
        const wardCandidates = wardIndex.get(wardKey) ?? [];
        row.wardCandidates = wardCandidates;
        row.errors = row.errors.filter(
          (e) => !e.includes("matches more than one ward") && !e.includes("not in the selected constituency coverage")
        );
        if (wardCandidates.length === 1) {
          row.wardMatch = "assigned";
          row.assignedWardId = wardCandidates[0]!.id;
        } else if (wardCandidates.length > 1) {
          row.wardMatch = "ambiguous";
          row.assignedWardId = null;
          row.errors.push(`Ward number ${wardKey} matches more than one ward in this constituency. Do not guess.`);
        } else {
          row.wardMatch = "invalid";
          row.assignedWardId = null;
          row.errors.push(`Ward number ${wardKey} is not in the selected constituency coverage.`);
        }
      }
    }
    refreshRejected(row);
  }
}

function refreshRejected(row: StagedImportRow): void {
  row.rejected =
    row.identifierReview === "needed" ||
    row.errors.some(
      (e) =>
        e.startsWith("Row needs") ||
        e.includes("spreadsheet formula") ||
        e.includes("matches more than one ward") ||
        e.includes("not in the selected constituency coverage")
    );
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
    if (!selected.has(row.sourceRowNumber) || row.empty) continue;
    row.assignedWardId = wardId;
    row.wardMatch = wardId ? "assigned" : "unassigned";
    row.errors = row.errors.filter(
      (e) => !e.startsWith("Ward number") || e.includes("numeric") || e.includes("Leading zeros") || e.includes("formula")
    );
    refreshRejected(row);
  }
  return summarize(session);
}

function blockingForCommit(row: StagedImportRow): boolean {
  if (row.empty) return false;
  if (row.identifierReview === "needed") return true;
  return row.errors.some(
    (e) =>
      e.startsWith("Row needs") ||
      e.includes("spreadsheet formula") ||
      (e.includes("matches more than one ward") && !row.assignedWardId) ||
      (e.includes("not in the selected constituency coverage") && !row.assignedWardId && row.wardMatch === "invalid")
  );
}

export function commitImport(
  db: Database.Database,
  sessionId: string,
  acknowledgeRepeat = false,
  onProgress?: ImportProgressFn
): ImportCommitResult {
  const session = getSession(sessionId);
  if (!session.rollEditionId) throw new AppError("validation", "Select a roll edition.");
  if (session.staged.length === 0) throw new AppError("validation", "Validate the file before importing.");
  if (session.staged.some((row) => row.identifierReview === "needed")) {
    throw new AppError(
      "import_invalid",
      "Resolve identifier review before commit. WIN WIN will not guess missing zeros. No records were imported."
    );
  }
  const eligible = session.staged.filter((row) => !row.empty && !blockingForCommit(row));
  const rejected = session.staged.filter((row) => !row.empty && blockingForCommit(row)).length;
  if (eligible.length === 0) {
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
  onProgress?.({ phase: "commit", processed: 0, total: eligible.length, message: "Committing atomically…" });
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
      eligible.length,
      JSON.stringify(session.mapping),
      ts,
      ts
    );
    const insert = db.prepare(
      `INSERT INTO voter_entries (
        id, roll_edition_id, constituency_id, import_batch_id, source_row_number,
        source_name, source_name_en, source_electoral_id, source_roll_serial, source_age, source_age_reference_date,
        source_address, source_section, source_page, source_ward_label,
        local_name, local_name_en, local_electoral_id, local_roll_serial, local_age, local_age_reference_date, local_address,
        assigned_ward_id, verification_status, verified_at, archived, archive_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, NULL, ?, 'unverified', NULL, 0, '', ?, ?)`
    );
    const hist = db.prepare(
      "INSERT INTO ward_assignment_history (id, voter_id, from_ward_id, to_ward_id, reason, changed_at, verification_source) VALUES (?, ?, NULL, ?, 'import', ?, 'import-file')"
    );
    for (const row of eligible) {
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
        row.corrections.electoralId ?? null,
        row.corrections.rollSerial ?? null,
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
    if (session.cancelled) throw new AppError("import_cancelled", "This import session is no longer available.");
    const flaggedDuplicates = tx();
    const unassigned = eligible.filter((r) => !r.assignedWardId).length;
    const imported = eligible.length;
    sessions.delete(sessionId);
    onProgress?.({ phase: "commit", processed: imported, total: imported, message: "Commit finished." });
    return { imported, batchId, flaggedDuplicates, unassigned, rejected };
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

export function errorReportFromSession(sessionId: string): string {
  const session = getSession(sessionId);
  const issues = session.staged.flatMap((row) =>
    row.errors.map((message) => [String(row.sourceRowNumber), "row", message])
  );
  return stringifyCsv([["source_row_number", "field", "message"], ...issues]);
}

export { sessions };
