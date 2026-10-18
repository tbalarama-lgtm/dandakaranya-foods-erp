import ExcelJS from "exceljs";
import type { VoterListItem } from "@shared/types";
import { guardSpreadsheetCell, stringifyCsv } from "./csv";

const EXPORT_HEADERS = [
  "name_original_or_local",
  "name_english",
  "electoral_id",
  "roll_serial",
  "published_age",
  "age_reference_date",
  "address",
  "ward",
  "roll_edition",
  "verification_status",
  "source_row"
];

function rowOf(item: VoterListItem): string[] {
  return [
    item.displayName,
    item.displayNameEn,
    item.displayElectoralId,
    item.displayRollSerial,
    item.localAge ?? item.sourceAge,
    item.localAgeReferenceDate ?? item.sourceAgeReferenceDate,
    item.displayAddress,
    item.wardLabel ?? "Unassigned",
    item.editionName,
    item.verificationStatus,
    item.sourceRowNumber == null ? "" : String(item.sourceRowNumber)
  ].map(guardSpreadsheetCell);
}

export function exportVotersCsv(items: VoterListItem[]): string {
  return stringifyCsv([EXPORT_HEADERS, ...items.map(rowOf)]);
}

export async function exportVotersXlsx(items: VoterListItem[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("voters");
  sheet.addRow(EXPORT_HEADERS);
  for (const item of items) sheet.addRow(rowOf(item));
  for (let i = 1; i <= EXPORT_HEADERS.length; i += 1) sheet.getColumn(i).numFmt = "@";
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
