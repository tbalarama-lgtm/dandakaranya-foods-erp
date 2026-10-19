import { createHash } from "node:crypto";
import {
  RESERVATION_CATEGORIES,
  RESERVATION_CONTROL_EXPECTATIONS,
  RESERVATION_SHEET_NAME
} from "@shared/constants";
import type {
  ReservationCategory,
  ReservationControlDiff,
  ReservationControls,
  ReservationParsedRow,
  ReservationSeatDraft,
  ReservationWorkbookPreview
} from "@shared/types";
import { AppError } from "../errors";
import { colLetter, type SheetCell } from "./xlsx-sheet";

const CATEGORY_SET = new Set<string>(RESERVATION_CATEGORIES);

export function proposeMandalLabel(sourceLabel: string): { proposed: string; derivedFromSuffix: boolean } {
  const trimmed = sourceLabel.trim();
  const match = /^(.*?)[-–—]\s*\d+$/.exec(trimmed);
  if (match?.[1]?.trim()) {
    return { proposed: match[1]!.trim(), derivedFromSuffix: true };
  }
  return { proposed: trimmed, derivedFromSuffix: false };
}

export function normalizeReservationCode(raw: string): {
  original: string;
  category: ReservationCategory;
  womenReserved: boolean;
  displayCode: string;
  valid: boolean;
  missing: boolean;
} {
  const original = (raw ?? "").trim();
  if (!original) {
    return {
      original: "",
      category: "not_recorded",
      womenReserved: false,
      displayCode: "Not recorded",
      valid: false,
      missing: true
    };
  }
  const compact = original.toUpperCase().replaceAll(/\s+/g, "");
  const womenReserved = compact.endsWith("(W)");
  const stem = womenReserved ? compact.slice(0, -3) : compact;
  if (CATEGORY_SET.has(stem)) {
    const category = stem as ReservationCategory;
    return {
      original,
      category,
      womenReserved,
      displayCode: womenReserved ? `${category}(W)` : category,
      valid: true,
      missing: false
    };
  }
  return {
    original,
    category: "unknown",
    womenReserved: false,
    displayCode: original,
    valid: false,
    missing: false
  };
}

export function womenReservedExplanation(womenReserved: boolean): string {
  return womenReserved ? "Women-reserved" : "Not specifically reserved for women";
}

function cell(row: SheetCell[] | undefined, col1: number): SheetCell {
  return row?.[col1 - 1] ?? { text: "", formula: false, type: "empty" };
}

function isEmptyRow(row: SheetCell[]): boolean {
  return row.every((item) => !item.text.trim() && !item.formula);
}

export function parsePanchayatReservationSheet(
  cells: SheetCell[][],
  meta: { fileName: string; worksheetName: string }
): ReservationWorkbookPreview {
  if (meta.worksheetName.trim().toUpperCase() !== RESERVATION_SHEET_NAME) {
    throw new AppError(
      "invalid_import",
      `Read only "${RESERVATION_SHEET_NAME}". Other worksheets are not imported.`
    );
  }
  if (cells.length < 3) throw new AppError("invalid_import", "The reservation worksheet is missing heading rows.");
  const heading = cells[0] ?? [];
  const header = cells[1] ?? [];
  const issues: string[] = [];
  const districtParts = heading.slice(4).map((c) => c.text.trim()).filter(Boolean);
  const districtSource = [...new Set(districtParts)].join(" ") || heading[4]?.text.trim() || "";

  let year: number | null = null;
  for (let col = 1; col <= 4; col += 1) {
    const value = cell(header, col);
    if (value.formula) {
      issues.push(`Election year cell ${colLetter(col)}2 is a formula and was not executed.`);
      continue;
    }
    const match = /\b(19|20)\d{2}\b/.exec(value.text);
    if (match) year = Number(match[0]);
  }
  if (year == null) issues.push("Election year was not found in row 2.");

  const wardHeaders: Array<{ col: number; wardNumber: string; formula: boolean; duplicate: boolean }> = [];
  const seenWard = new Map<string, number>();
  for (let col = 5; col <= (header.length || heading.length); col += 1) {
    const value = cell(header, col);
    if (!value.text.trim() && !value.formula) continue;
    if (value.formula) {
      issues.push(`Ward header ${colLetter(col)}2 is a formula. Formulas are not used as ward numbers.`);
      continue;
    }
    const wardNumber = value.text.trim();
    if (!/^\d+$/.test(wardNumber)) {
      issues.push(`Ward header ${colLetter(col)}2 is not a ward number (${wardNumber}).`);
      continue;
    }
    const count = (seenWard.get(wardNumber) ?? 0) + 1;
    seenWard.set(wardNumber, count);
    wardHeaders.push({ col, wardNumber, formula: false, duplicate: count > 1 });
    if (count > 1) issues.push(`Duplicate ward header ${wardNumber} in column ${colLetter(col)}.`);
  }
  if (!wardHeaders.length) issues.push("No ward numbers were found in row 2 from column E onward.");

  const rows: ReservationParsedRow[] = [];
  const gpKeys = new Map<string, number>();
  let declaredWardSeats = 0;
  let populatedWardReservations = 0;
  let missingReservationCells = 0;
  let invalidReservationCodes = 0;
  const sarpanchByCode: Record<string, number> = {};
  const wardByCode: Record<string, number> = {};
  const mandalProposedCounts: Record<string, number> = {};

  for (let i = 2; i < cells.length; i += 1) {
    const row = cells[i] ?? [];
    if (isEmptyRow(row)) continue;
    const sourceRow = i + 1;
    const mandalCell = cell(row, 1);
    const gpCell = cell(row, 2);
    const sarpanchCell = cell(row, 3);
    const countCell = cell(row, 4);
    const sourceMandal = mandalCell.text.trim();
    const sourceGp = gpCell.text.trim();
    if (!sourceGp) {
      issues.push(`Row ${sourceRow} has no Gram Panchayat name and was skipped as a section label (${sourceMandal || "blank"}).`);
      continue;
    }
    const proposed = proposeMandalLabel(sourceMandal);
    mandalProposedCounts[proposed.proposed] = (mandalProposedCounts[proposed.proposed] ?? 0) + 1;
    const gpKey = `${sourceMandal}||${sourceGp}`;
    gpKeys.set(gpKey, (gpKeys.get(gpKey) ?? 0) + 1);

    const rowIssues: string[] = [];
    if (mandalCell.formula) rowIssues.push("Mandal label is a formula and was not executed.");
    if (gpCell.formula) rowIssues.push("Gram Panchayat name is a formula and was not executed.");
    if (sarpanchCell.formula) rowIssues.push("Sarpanch reservation is a formula and was not executed.");
    if (countCell.formula) rowIssues.push("Declared ward count is a formula and was not executed.");

    let declaredWardCount: number | null = null;
    if (countCell.text.trim()) {
      const parsed = Number(countCell.text.trim());
      if (Number.isInteger(parsed) && parsed >= 0) declaredWardCount = parsed;
      else rowIssues.push(`Declared ward count "${countCell.text}" is not a whole number.`);
    } else {
      rowIssues.push("Declared ward count is missing.");
    }
    if (declaredWardCount != null) declaredWardSeats += declaredWardCount;

    const sarpanch = normalizeReservationCode(sarpanchCell.formula ? "" : sarpanchCell.text);
    if (sarpanchCell.formula) {
      sarpanch.missing = false;
      invalidReservationCodes += 1;
    } else if (sarpanch.missing) {
      invalidReservationCodes += 0;
      missingReservationCells += 1;
    } else if (!sarpanch.valid) {
      invalidReservationCodes += 1;
    } else {
      sarpanchByCode[sarpanch.displayCode] = (sarpanchByCode[sarpanch.displayCode] ?? 0) + 1;
    }

    const wardSeats: ReservationParsedRow["wardSeats"] = [];
    let populated = 0;
    for (const headerCol of wardHeaders) {
      const seatCell = cell(row, headerCol.col);
      const wardNum = Number(headerCol.wardNumber);
      const beyond = declaredWardCount != null && wardNum > declaredWardCount;
      if (beyond) {
        if (seatCell.text.trim() || seatCell.formula) {
          rowIssues.push(
            `Ward ${headerCol.wardNumber} has a reservation outside the declared count ${declaredWardCount}.`
          );
        }
        continue;
      }
      if (seatCell.formula) {
        rowIssues.push(`Ward ${headerCol.wardNumber} reservation is a formula and was not executed.`);
        invalidReservationCodes += 1;
        wardSeats.push({
          wardNumber: headerCol.wardNumber,
          cell: `${colLetter(headerCol.col)}${sourceRow}`,
          original: seatCell.text,
          category: "unknown",
          womenReserved: false,
          missing: false,
          valid: false,
          formula: true
        });
        continue;
      }
      const code = normalizeReservationCode(seatCell.text);
      if (code.missing) {
        missingReservationCells += 1;
        rowIssues.push(`Ward ${headerCol.wardNumber} reservation is not recorded.`);
      } else if (!code.valid) {
        invalidReservationCodes += 1;
        rowIssues.push(`Ward ${headerCol.wardNumber} has unknown code "${code.original}".`);
      } else {
        populated += 1;
        populatedWardReservations += 1;
        wardByCode[code.displayCode] = (wardByCode[code.displayCode] ?? 0) + 1;
      }
      wardSeats.push({
        wardNumber: headerCol.wardNumber,
        cell: `${colLetter(headerCol.col)}${sourceRow}`,
        original: code.original,
        category: code.category,
        womenReserved: code.womenReserved,
        missing: code.missing,
        valid: code.valid,
        formula: false
      });
    }
    if (declaredWardCount != null && populated !== declaredWardCount) {
      rowIssues.push(`Declared ${declaredWardCount} wards but ${populated} populated reservation cells.`);
    }

    rows.push({
      sourceRow,
      sourceMandal,
      sourceGp,
      proposedMandal: proposed.proposed,
      derivedMandalFromSuffix: proposed.derivedFromSuffix,
      sarpanchOriginal: sarpanch.original,
      sarpanchCategory: sarpanch.category,
      sarpanchWomenReserved: sarpanch.womenReserved,
      sarpanchValid: sarpanch.valid && !sarpanchCell.formula,
      declaredWardCount,
      populatedWardCount: populated,
      duplicateGp: false,
      wardSeats,
      issues: rowIssues
    });
  }

  for (const row of rows) {
    if ((gpKeys.get(`${row.sourceMandal}||${row.sourceGp}`) ?? 0) > 1) {
      row.duplicateGp = true;
      row.issues.push("Duplicate Gram Panchayat row for this source mandal label.");
    }
  }

  const tanuku = Object.entries(mandalProposedCounts)
    .filter(([name]) => name.toLowerCase() === "tanuku")
    .reduce((sum, [, n]) => sum + n, 0);
  const attili = Object.entries(mandalProposedCounts)
    .filter(([name]) => name.toLowerCase() === "attili")
    .reduce((sum, [, n]) => sum + n, 0);
  const iragavaram = Object.entries(mandalProposedCounts)
    .filter(([name]) => name.toLowerCase() === "iragavaram")
    .reduce((sum, [, n]) => sum + n, 0);

  const controls: ReservationControls = {
    year,
    gramPanchayats: rows.length,
    tanuku,
    attili,
    iragavaram,
    sarpanchReservations: rows.length,
    declaredWardSeats,
    populatedWardReservations,
    missingReservationCells,
    invalidReservationCodes,
    sarpanchByCode,
    wardByCode,
    mandalProposedCounts
  };

  const expected = RESERVATION_CONTROL_EXPECTATIONS;
  const diffs: ReservationControlDiff[] = [];
  const compare = (label: string, actual: number, exp: number) => {
    if (actual !== exp) diffs.push({ label, actual, expected: exp });
  };
  compare("Year", year ?? 0, expected.year);
  compare("Gram Panchayats", controls.gramPanchayats, expected.gramPanchayats);
  compare("Tanuku", tanuku, expected.tanuku);
  compare("Attili", attili, expected.attili);
  compare("Iragavaram", iragavaram, expected.iragavaram);
  compare("Sarpanch reservations", controls.sarpanchReservations, expected.sarpanchReservations);
  compare("Declared ward seats", declaredWardSeats, expected.declaredWardSeats);
  compare("Populated ward reservations", populatedWardReservations, expected.populatedWardReservations);
  compare("Missing reservation cells", missingReservationCells, expected.missingReservationCells);
  compare("Invalid reservation codes", invalidReservationCodes, expected.invalidReservationCodes);
  for (const [code, exp] of Object.entries(expected.sarpanchByCode)) {
    compare(`Sarpanch ${code}`, sarpanchByCode[code] ?? 0, exp);
  }
  for (const [code, exp] of Object.entries(expected.wardByCode)) {
    compare(`Ward member ${code}`, wardByCode[code] ?? 0, exp);
  }

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        sheet: meta.worksheetName,
        year,
        rows: rows.map((row) => ({
          m: row.sourceMandal,
          g: row.sourceGp,
          s: row.sarpanchOriginal,
          d: row.declaredWardCount,
          w: row.wardSeats.map((seat) => [seat.wardNumber, seat.original])
        }))
      }),
      "utf8"
    )
    .digest("hex");

  return {
    fileName: meta.fileName,
    worksheetName: meta.worksheetName,
    districtSource,
    year,
    wardHeaders: wardHeaders.map((h) => h.wardNumber),
    rows,
    controls,
    expectedControls: {
      year: expected.year,
      gramPanchayats: expected.gramPanchayats,
      tanuku: expected.tanuku,
      attili: expected.attili,
      iragavaram: expected.iragavaram,
      sarpanchReservations: expected.sarpanchReservations,
      declaredWardSeats: expected.declaredWardSeats,
      populatedWardReservations: expected.populatedWardReservations,
      missingReservationCells: expected.missingReservationCells,
      invalidReservationCodes: expected.invalidReservationCodes,
      sarpanchByCode: { ...expected.sarpanchByCode },
      wardByCode: { ...expected.wardByCode },
      mandalProposedCounts: {}
    },
    controlDiffs: diffs,
    issues,
    fingerprint,
    controlNote:
      "These are workbook reconciliation controls, not proof that the notification is officially accurate."
  };
}

export function draftsFromPreview(preview: ReservationWorkbookPreview): ReservationSeatDraft[] {
  const drafts: ReservationSeatDraft[] = [];
  for (const row of preview.rows) {
    drafts.push({
      seatType: "sarpanch",
      sourceMandal: row.sourceMandal,
      sourceGp: row.sourceGp,
      proposedMandal: row.proposedMandal,
      derivedMandalFromSuffix: row.derivedMandalFromSuffix,
      sourceWardNumber: "",
      declaredWardCount: row.declaredWardCount,
      originalCode: row.sarpanchOriginal,
      category: row.sarpanchCategory,
      womenReserved: row.sarpanchWomenReserved,
      sourceRow: row.sourceRow,
      sourceCell: `C${row.sourceRow}`,
      issues: row.sarpanchValid ? [] : [...row.issues.filter((i) => /Sarpanch|not recorded|formula/i.test(i))]
    });
    for (const seat of row.wardSeats) {
      const issues: string[] = [];
      if (seat.formula) issues.push("Formula cells are not imported as reservation codes.");
      else if (seat.missing) issues.push("Reservation is not recorded.");
      else if (!seat.valid) issues.push(`Unknown reservation code "${seat.original}".`);
      drafts.push({
        seatType: "ward_member",
        sourceMandal: row.sourceMandal,
        sourceGp: row.sourceGp,
        proposedMandal: row.proposedMandal,
        derivedMandalFromSuffix: row.derivedMandalFromSuffix,
        sourceWardNumber: seat.wardNumber,
        declaredWardCount: row.declaredWardCount,
        originalCode: seat.original,
        category: seat.category,
        womenReserved: seat.womenReserved,
        sourceRow: row.sourceRow,
        sourceCell: seat.cell,
        issues
      });
    }
  }
  return drafts;
}
