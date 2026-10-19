import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { RESERVATION_EXCLUDED_SHEETS } from "@shared/constants";
import { AppError } from "../errors";

export interface WorksheetName {
  name: string;
  hidden: boolean;
  excluded: boolean;
}

export interface SheetCell {
  text: string;
  formula: boolean;
  type: "text" | "number" | "empty" | "formula" | "boolean" | "shared";
}

const EXCLUDED = new Set(RESERVATION_EXCLUDED_SHEETS.map((name) => name.toUpperCase()));

export function isExcludedSheetName(name: string): boolean {
  return EXCLUDED.has(name.trim().toUpperCase());
}

function localName(tag: string): string {
  const i = tag.indexOf("}");
  return i >= 0 ? tag.slice(i + 1) : tag;
}

function unzipEntries(filePath: string, accept?: (name: string) => boolean): Map<string, Buffer> {
  const bytes = fs.readFileSync(filePath);
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (bytes.readUInt32LE(offset) !== 0x04034b50) break;
    const flags = bytes.readUInt16LE(offset + 6);
    const method = bytes.readUInt16LE(offset + 8);
    const compSize = bytes.readUInt32LE(offset + 18);
    const uncompSize = bytes.readUInt32LE(offset + 22);
    const nameLen = bytes.readUInt16LE(offset + 26);
    const extraLen = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLen).toString("utf8").replaceAll("\\", "/");
    const dataStart = offset + 30 + nameLen + extraLen;
    const skip = Boolean(accept) && !accept!(name);
    if (!skip) {
      const compressed = bytes.subarray(dataStart, dataStart + compSize);
      let data: Buffer;
      if (method === 0) data = Buffer.from(compressed);
      else if (method === 8) data = inflateRawSync(compressed, { maxOutputLength: Math.max(uncompSize, 1) + 32 });
      else throw new AppError("invalid_import", `Unsupported ZIP compression in ${path.basename(filePath)}.`);
      entries.set(name, data);
    }
    if (flags & 0x8) {
      throw new AppError("invalid_import", "Workbook ZIP data descriptors are not supported for reservation import.");
    }
    offset = dataStart + compSize;
  }
  return entries;
}

function colRow(ref: string): { col: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!match) return null;
  let col = 0;
  for (const ch of match[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(match[2]) };
}

function textOfSi(body: string): string {
  const parts: string[] = [];
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    parts.push(decodeXml(match[1] ?? ""));
  }
  return parts.join("");
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function attr(blob: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(blob);
  return match ? decodeXml(match[1]!) : null;
}

export function listWorkbookSheets(filePath: string): WorksheetName[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".txt") return [{ name: "CSV", hidden: false, excluded: false }];
  if (ext !== ".xlsx") throw new AppError("invalid_import", "Use a .csv or .xlsx file.");
  const entries = unzipEntries(
    filePath,
    (name) => name === "xl/workbook.xml" || name === "xl/_rels/workbook.xml.rels"
  );
  const workbook = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new AppError("invalid_import", "The workbook is missing sheet metadata.");
  const ridToTarget = new Map<string, string>();
  for (const match of rels.toString("utf8").matchAll(/<Relationship\b[^>]*>/gi)) {
    const id = attr(match[0]!, "Id");
    const target = attr(match[0]!, "Target");
    if (id && target) ridToTarget.set(id, target.replace(/^\//, "").replace(/^\.\.\//, "xl/"));
  }
  const sheets: WorksheetName[] = [];
  for (const match of workbook.toString("utf8").matchAll(/<sheet\b[^>]*>/gi)) {
    const name = attr(match[0]!, "name") ?? "Sheet";
    const state = (attr(match[0]!, "state") ?? "").toLowerCase();
    sheets.push({
      name,
      hidden: state === "hidden" || state === "veryhidden",
      excluded: isExcludedSheetName(name)
    });
  }
  if (!sheets.length) throw new AppError("invalid_import", "The workbook has no worksheets.");
  void ridToTarget;
  return sheets;
}

function loadNeededStrings(xml: string, needed: Set<number>): Map<number, string> {
  const map = new Map<number, string>();
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(xml))) {
    if (needed.has(index)) map.set(index, textOfSi(match[1] ?? ""));
    index += 1;
  }
  return map;
}

export function readWorkbookSheet(
  filePath: string,
  sheetName: string
): { cells: SheetCell[][]; worksheetName: string } {
  if (isExcludedSheetName(sheetName)) {
    throw new AppError(
      "invalid_import",
      `Worksheet "${sheetName}" is excluded. Pension and unrelated sheets are not parsed.`
    );
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".txt") {
    throw new AppError("invalid_import", "Reservation imports require the PANCHAYAT RESERVATIONS Excel worksheet.");
  }
  const meta = unzipEntries(
    filePath,
    (name) => name === "xl/workbook.xml" || name === "xl/_rels/workbook.xml.rels"
  );
  const workbook = meta.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = meta.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const ridToTarget = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b[^>]*>/gi)) {
    const id = attr(match[0]!, "Id");
    let target = attr(match[0]!, "Target");
    if (!id || !target) continue;
    target = target.replace(/^\//, "");
    if (!target.startsWith("xl/")) target = `xl/${target.replace(/^\.\.\//, "")}`;
    ridToTarget.set(id, target);
  }
  let targetPath: string | null = null;
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/gi)) {
    const name = attr(match[0]!, "name") ?? "";
    const rid = attr(match[0]!, "r:id") ?? attr(match[0]!, "id");
    if (name === sheetName && rid) targetPath = ridToTarget.get(rid) ?? null;
  }
  if (!targetPath) throw new AppError("invalid_import", `Worksheet "${sheetName}" was not found.`);
  const wanted = new Set([targetPath, "xl/sharedStrings.xml"]);
  const entries = unzipEntries(filePath, (name) => wanted.has(name));
  const sheetXml = entries.get(targetPath);
  if (!sheetXml) throw new AppError("invalid_import", `Worksheet "${sheetName}" could not be read.`);
  const sheetText = sheetXml.toString("utf8");
  const needed = new Set<number>();
  const cellMatches = [...sheetText.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)];
  for (const match of cellMatches) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    if (/\bt="s"/i.test(attrs)) {
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body)?.[1];
      if (v != null && v !== "") needed.add(Number(v));
    }
  }
  const ssXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const strings = ssXml ? loadNeededStrings(ssXml, needed) : new Map<number, string>();
  const sparse = new Map<string, SheetCell>();
  let maxRow = 0;
  let maxCol = 0;
  for (const match of cellMatches) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const ref = attr(` ${attrs} `, "r");
    if (!ref) continue;
    const pos = colRow(ref);
    if (!pos) continue;
    const formula = /<f\b/i.test(body);
    const typeAttr = attr(` ${attrs} `, "t") ?? "";
    const v = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body)?.[1] ?? "";
    let text = "";
    let type: SheetCell["type"] = "empty";
    if (typeAttr === "s") {
      text = strings.get(Number(v)) ?? "";
      type = text ? "shared" : "empty";
    } else if (typeAttr === "inlineStr") {
      text = textOfSi(body);
      type = text ? "text" : "empty";
    } else if (typeAttr === "b") {
      text = v === "1" ? "true" : "false";
      type = "boolean";
    } else if (formula) {
      text = v;
      type = "formula";
    } else if (v !== "") {
      text = v;
      type = typeAttr === "str" ? "text" : "number";
    }
    if (formula) type = "formula";
    sparse.set(`${pos.row}:${pos.col}`, { text: text.trim(), formula, type: text || formula ? type : "empty" });
    if (text || formula) {
      maxRow = Math.max(maxRow, pos.row);
      maxCol = Math.max(maxCol, pos.col);
    }
  }
  const cells: SheetCell[][] = [];
  for (let r = 1; r <= maxRow; r += 1) {
    const row: SheetCell[] = [];
    for (let c = 1; c <= maxCol; c += 1) {
      row.push(sparse.get(`${r}:${c}`) ?? { text: "", formula: false, type: "empty" });
    }
    cells.push(row);
  }
  return { cells, worksheetName: sheetName };
}

export function colLetter(index1: number): string {
  let n = index1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
