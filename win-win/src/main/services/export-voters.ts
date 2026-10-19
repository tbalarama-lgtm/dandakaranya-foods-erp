import ExcelJS from "exceljs";
import { VOTER_EXPORT_FIELDS, type VoterExportField } from "@shared/constants";
import type { VoterListItem } from "@shared/types";
import { guardSpreadsheetCell, stringifyCsv } from "./csv";
import { AppError } from "../errors";

const LABELS: Record<VoterExportField, string> = {
  displayName: "name_original_or_local",
  displayNameEn: "name_english",
  displayElectoralId: "electoral_id",
  displayRollSerial: "roll_serial",
  publishedAge: "published_age",
  ageReferenceDate: "age_reference_date",
  displayAddress: "address",
  ward: "ward",
  rollEdition: "roll_edition",
  verificationStatus: "verification_status",
  sourceRow: "source_row",
  sourceSection: "source_section",
  sourcePage: "source_page"
};

function valueOf(item: VoterListItem, field: VoterExportField): string {
  switch (field) {
    case "displayName":
      return item.displayName;
    case "displayNameEn":
      return item.displayNameEn;
    case "displayElectoralId":
      return item.displayElectoralId;
    case "displayRollSerial":
      return item.displayRollSerial;
    case "publishedAge":
      return item.localAge ?? item.sourceAge;
    case "ageReferenceDate":
      return item.localAgeReferenceDate ?? item.sourceAgeReferenceDate;
    case "displayAddress":
      return item.displayAddress;
    case "ward":
      return item.wardLabel ?? "Unassigned";
    case "rollEdition":
      return item.editionName;
    case "verificationStatus":
      return item.verificationStatus;
    case "sourceRow":
      return item.sourceRowNumber == null ? "" : String(item.sourceRowNumber);
    case "sourceSection":
      return item.sourceSection;
    case "sourcePage":
      return item.sourcePage;
    default:
      return "";
  }
}

export function normalizeExportFields(fields?: string[]): VoterExportField[] {
  const requested = (fields ?? []).filter((field): field is VoterExportField =>
    (VOTER_EXPORT_FIELDS as readonly string[]).includes(field)
  );
  if (requested.length === 0) {
    throw new AppError("validation", "Select at least one export field. Personal fields are not included unless chosen.");
  }
  return requested;
}

function rowOf(item: VoterListItem, fields: VoterExportField[]): string[] {
  return fields.map((field) => guardSpreadsheetCell(valueOf(item, field)));
}

export function exportVotersCsv(items: VoterListItem[], fields?: string[]): string {
  const selected = normalizeExportFields(fields);
  return stringifyCsv([selected.map((field) => LABELS[field]), ...items.map((item) => rowOf(item, selected))]);
}

export async function exportVotersXlsx(items: VoterListItem[], fields?: string[]): Promise<Buffer> {
  const selected = normalizeExportFields(fields);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("voters");
  sheet.addRow(selected.map((field) => LABELS[field]));
  for (const item of items) sheet.addRow(rowOf(item, selected));
  for (let i = 1; i <= selected.length; i += 1) sheet.getColumn(i).numFmt = "@";
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
