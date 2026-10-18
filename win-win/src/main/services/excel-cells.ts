import type ExcelJS from "exceljs";

export type CellType = "text" | "number" | "formula" | "empty" | "boolean" | "date" | "error";

export interface CellRecord {
  text: string;
  type: CellType;
  raw: string;
  displayed: string;
  originalTextEstablished: boolean;
  precisionUnreliable: boolean;
  formula: boolean;
}

export const IDENTIFIER_FIELDS = ["electoralId", "rollSerial", "wardNumber"] as const;
export type IdentifierField = (typeof IDENTIFIER_FIELDS)[number];

export function rawNumberString(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER) return String(n);
  return n.toString();
}

export function uniqueHeaders(raw: string[]): { columns: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  const columns = raw.map((header, index) => {
    let name = header.trim();
    if (!name) {
      name = `column_${index + 1}`;
      warnings.push(`Blank header in column ${index + 1} was labeled ${name}.`);
    }
    const key = name.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) {
      const unique = `${name} (${count})`;
      warnings.push(`Duplicate header "${name}" was renamed to "${unique}" so columns stay distinct.`);
      return unique;
    }
    return name;
  });
  return { columns, warnings };
}

export function textCell(value: string): CellRecord {
  const text = value ?? "";
  if (!text) {
    return {
      text: "",
      type: "empty",
      raw: "",
      displayed: "",
      originalTextEstablished: true,
      precisionUnreliable: false,
      formula: false
    };
  }
  return {
    text,
    type: "text",
    raw: text,
    displayed: text,
    originalTextEstablished: true,
    precisionUnreliable: false,
    formula: false
  };
}

export function classifyExcelCell(cell: ExcelJS.Cell): CellRecord {
  const value = cell.value;
  const displayed = String(cell.text ?? "").trim();
  if (value == null || value === "") {
    return {
      text: "",
      type: "empty",
      raw: "",
      displayed,
      originalTextEstablished: true,
      precisionUnreliable: false,
      formula: false
    };
  }
  if (typeof value === "object" && value && ("formula" in value || "sharedFormula" in value)) {
    const rec = value as { formula?: string; sharedFormula?: string; result?: unknown };
    const formulaText = String(rec.formula || rec.sharedFormula || "");
    const resultText = rec.result == null ? "" : String(rec.result);
    return {
      text: "",
      type: "formula",
      raw: formulaText,
      displayed: displayed || resultText,
      originalTextEstablished: false,
      precisionUnreliable: false,
      formula: true
    };
  }
  if (typeof value === "number") {
    const raw = rawNumberString(value);
    const unsafe = !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER;
    return {
      text: raw,
      type: "number",
      raw,
      displayed: displayed || raw,
      originalTextEstablished: false,
      precisionUnreliable: unsafe || /e/i.test(raw),
      formula: false
    };
  }
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 10);
    return {
      text: iso,
      type: "date",
      raw: iso,
      displayed: displayed || iso,
      originalTextEstablished: true,
      precisionUnreliable: false,
      formula: false
    };
  }
  if (typeof value === "boolean") {
    const text = value ? "true" : "false";
    return {
      text,
      type: "boolean",
      raw: text,
      displayed: displayed || text,
      originalTextEstablished: true,
      precisionUnreliable: false,
      formula: false
    };
  }
  if (typeof value === "string") {
    return {
      text: value,
      type: "text",
      raw: value,
      displayed: displayed || value,
      originalTextEstablished: true,
      precisionUnreliable: false,
      formula: false
    };
  }
  const rec = value as { text?: string; richText?: Array<{ text: string }>; hyperlink?: string; error?: string };
  if (typeof rec.error === "string") {
    return {
      text: "",
      type: "error",
      raw: rec.error,
      displayed: displayed || rec.error,
      originalTextEstablished: false,
      precisionUnreliable: false,
      formula: false
    };
  }
  if (typeof rec.text === "string") {
    return textCell(rec.text);
  }
  if (Array.isArray(rec.richText)) {
    return textCell(rec.richText.map((part) => part.text).join(""));
  }
  return textCell(String(value));
}
