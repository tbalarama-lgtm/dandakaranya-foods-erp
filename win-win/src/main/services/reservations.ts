import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type Database from "better-sqlite3";
import { PAGE_SIZE, RESERVATION_SHEET_NAME } from "@shared/constants";
import type {
  PagedResult,
  ReservationCommitResult,
  ReservationGeoCreatePlan,
  ReservationHistoryItem,
  ReservationImportSession,
  ReservationMandalProposal,
  ReservationMatrixRow,
  ReservationNotification,
  ReservationNotificationStatus,
  ReservationReviewStatus,
  ReservationSeat,
  ReservationSeatType,
  ReservationStagedRow,
  ReservationSummary,
  ReservationWorkbookPreview
} from "@shared/types";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import { writeAudit } from "./audit";
import { resolveScope } from "./coverage";
import { guardSpreadsheetCell, stringifyCsv } from "./csv";
import { createGp, createMandal } from "./geo";
import { createWard } from "./wards";
import { draftsFromPreview, parsePanchayatReservationSheet, proposeMandalLabel } from "./reservations-parse";
import { isExcludedSheetName, listWorkbookSheets, readWorkbookSheet } from "./xlsx-sheet";

const sessions = new Map<string, ReservationImportSession>();

function fold(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function mapNotification(row: Record<string, unknown>, electionName?: string): ReservationNotification {
  return {
    id: String(row.id),
    constituencyId: String(row.constituency_id),
    electionId: String(row.election_id),
    boundaryVersionId: String(row.boundary_version_id),
    year: Number(row.year),
    name: String(row.name),
    notificationReference: String(row.notification_reference ?? ""),
    notificationDate: (row.notification_date as string | null) ?? null,
    districtSource: String(row.district_source ?? ""),
    status: row.status as ReservationNotificationStatus,
    notes: String(row.notes ?? ""),
    verifiedAt: (row.verified_at as string | null) ?? null,
    verifiedNotes: String(row.verified_notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    electionName
  };
}

function mapSeat(row: Record<string, unknown>): ReservationSeat {
  return {
    id: String(row.id),
    notificationId: String(row.notification_id),
    importBatchId: (row.import_batch_id as string | null) ?? null,
    electionId: String(row.election_id),
    year: Number(row.year),
    seatType: row.seat_type as ReservationSeatType,
    gramPanchayatId: (row.gram_panchayat_id as string | null) ?? null,
    wardId: (row.ward_id as string | null) ?? null,
    sourceMandalLabel: String(row.source_mandal_label),
    sourceGpLabel: String(row.source_gp_label),
    sourceWardNumber: String(row.source_ward_number ?? ""),
    declaredWardCount: row.declared_ward_count == null ? null : Number(row.declared_ward_count),
    originalCode: String(row.original_code ?? ""),
    category: row.category as ReservationSeat["category"],
    womenReserved: Boolean(row.women_reserved),
    reviewStatus: row.review_status as ReservationReviewStatus,
    sourceFilename: String(row.source_filename ?? ""),
    sourceWorksheet: String(row.source_worksheet ?? ""),
    sourceRow: row.source_row == null ? null : Number(row.source_row),
    sourceCell: String(row.source_cell ?? ""),
    verificationNotes: String(row.verification_notes ?? ""),
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    gpName: row.gp_name ? String(row.gp_name) : undefined,
    wardName: row.ward_name ? String(row.ward_name) : undefined,
    mandalName: row.mandal_name ? String(row.mandal_name) : undefined
  };
}

export function listReservationNotifications(
  db: Database.Database,
  input: { constituencyId: string; electionId?: string }
): ReservationNotification[] {
  const rows = (
    input.electionId
      ? db
          .prepare(
            `SELECT n.*, e.name AS election_name FROM reservation_notifications n
             JOIN elections e ON e.id = n.election_id
             WHERE n.constituency_id = ? AND n.election_id = ?
             ORDER BY n.year DESC, n.created_at DESC`
          )
          .all(input.constituencyId, input.electionId)
      : db
          .prepare(
            `SELECT n.*, e.name AS election_name FROM reservation_notifications n
             JOIN elections e ON e.id = n.election_id
             WHERE n.constituency_id = ?
             ORDER BY n.year DESC, n.created_at DESC`
          )
          .all(input.constituencyId)
  ) as Array<Record<string, unknown>>;
  return rows.map((row) => mapNotification(row, String(row.election_name)));
}

export function createReservationNotification(
  db: Database.Database,
  input: {
    constituencyId: string;
    electionId: string;
    name: string;
    year?: number;
    notificationReference?: string;
    notificationDate?: string | null;
    notes?: string;
  }
): ReservationNotification {
  const election = db.prepare("SELECT * FROM elections WHERE id = ?").get(input.electionId) as
    | Record<string, unknown>
    | undefined;
  if (!election) throw new AppError("not_found", "Election workspace not found.");
  if (String(election.constituency_id) !== input.constituencyId) {
    throw new AppError("constituency_isolation", "The election belongs to a different constituency.");
  }
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO reservation_notifications (
      id, constituency_id, election_id, boundary_version_id, year, name, notification_reference,
      notification_date, district_source, status, notes, verified_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'draft', ?, '', ?, ?)`
  ).run(
    id,
    input.constituencyId,
    input.electionId,
    String(election.boundary_version_id),
    input.year ?? Number(election.year),
    input.name.trim(),
    input.notificationReference?.trim() ?? "",
    input.notificationDate ?? null,
    input.notes ?? "",
    ts,
    ts
  );
  writeAudit(db, { action: "create", entityType: "reservation_notification", recordId: id, changedFields: ["name", "year"] });
  return listReservationNotifications(db, { constituencyId: input.constituencyId }).find((row) => row.id === id)!;
}

export function getSession(sessionId: string): ReservationImportSession {
  const session = sessions.get(sessionId);
  if (!session) throw new AppError("import_cancelled", "This reservation import session is no longer available.");
  return session;
}

export function inspectReservationWorkbook(filePath: string): { worksheets: ReturnType<typeof listWorkbookSheets> } {
  const worksheets = listWorkbookSheets(filePath);
  return { worksheets };
}

export function createReservationSession(input: {
  constituencyId: string;
  filePath: string;
}): ReservationImportSession {
  const worksheets = listWorkbookSheets(input.filePath).map((sheet) => ({
    name: sheet.name,
    hidden: sheet.hidden,
    excluded: sheet.excluded
  }));
  const allowed = worksheets.filter((sheet) => !sheet.excluded);
  if (!allowed.length) {
    throw new AppError("invalid_import", "No reservation worksheet is available. Pension and blank sheets are excluded.");
  }
  const preferred = allowed.find((sheet) => sheet.name === RESERVATION_SHEET_NAME) ?? null;
  const session: ReservationImportSession = {
    sessionId: newId(),
    constituencyId: input.constituencyId,
    fileName: path.basename(input.filePath),
    filePath: input.filePath,
    worksheets,
    selectedSheet: preferred?.name ?? null,
    preview: null,
    electionId: null,
    notificationId: null,
    allowPartial: false,
    mandalApprovals: {},
    staged: [],
    geoPlan: null,
    eligibleCount: 0,
    unresolvedCount: 0,
    excludedCount: 0
  };
  sessions.set(session.sessionId, session);
  if (session.selectedSheet) loadPreview(session);
  return publicSession(session);
}

function publicSession(session: ReservationImportSession): ReservationImportSession {
  return { ...session, filePath: "" };
}

function loadPreview(session: ReservationImportSession): void {
  if (!session.selectedSheet) return;
  if (isExcludedSheetName(session.selectedSheet)) {
    throw new AppError("invalid_import", `Worksheet "${session.selectedSheet}" is excluded.`);
  }
  const { cells, worksheetName } = readWorkbookSheet(session.filePath, session.selectedSheet);
  session.preview = parsePanchayatReservationSheet(cells, { fileName: session.fileName, worksheetName });
}

export function reservationSelectSheet(sessionId: string, sheetName: string): ReservationImportSession {
  const session = getSession(sessionId);
  if (isExcludedSheetName(sheetName)) {
    throw new AppError("invalid_import", `Worksheet "${sheetName}" is excluded from reservation import.`);
  }
  session.selectedSheet = sheetName;
  loadPreview(session);
  restage(session);
  return publicSession(session);
}

export function reservationSetContext(
  db: Database.Database,
  input: { sessionId: string; electionId: string; notificationId?: string; notificationName?: string; year?: number }
): ReservationImportSession {
  const session = getSession(input.sessionId);
  const election = db.prepare("SELECT * FROM elections WHERE id = ?").get(input.electionId) as
    | Record<string, unknown>
    | undefined;
  if (!election) throw new AppError("not_found", "Election workspace not found.");
  if (String(election.constituency_id) !== session.constituencyId) {
    throw new AppError("constituency_isolation", "Select an election in the current constituency.");
  }
  session.electionId = input.electionId;
  if (input.notificationId) {
    const note = db.prepare("SELECT * FROM reservation_notifications WHERE id = ?").get(input.notificationId) as
      | Record<string, unknown>
      | undefined;
    if (!note) throw new AppError("not_found", "Reservation notification not found.");
    if (String(note.constituency_id) !== session.constituencyId || String(note.election_id) !== input.electionId) {
      throw new AppError("constituency_isolation", "Notification does not match the selected election.");
    }
    session.notificationId = input.notificationId;
  } else {
    const created = createReservationNotification(db, {
      constituencyId: session.constituencyId,
      electionId: input.electionId,
      name: input.notificationName?.trim() || `${session.preview?.year ?? election.year} reservation notification`,
      year: input.year ?? session.preview?.year ?? Number(election.year)
    });
    session.notificationId = created.id;
  }
  restage(session, db);
  return publicSession(session);
}

function listMandals(db: Database.Database): Array<{ id: string; name: string }> {
  return db.prepare("SELECT id, name FROM mandals WHERE archived = 0").all() as Array<{ id: string; name: string }>;
}

export function mandalProposals(session: ReservationImportSession, db?: Database.Database): ReservationMandalProposal[] {
  const preview = session.preview;
  if (!preview) return [];
  const grouped = new Map<string, ReservationMandalProposal>();
  const mandals = db ? listMandals(db) : [];
  for (const row of preview.rows) {
    const key = fold(row.proposedMandal);
    let group = grouped.get(key);
    if (!group) {
      const candidates = mandals.filter((item) => fold(item.name) === key);
      const approval = session.mandalApprovals[key];
      let matchStatus: ReservationMandalProposal["matchStatus"] = "unmatched";
      if (approval?.approved && approval.mandalId) matchStatus = "approved";
      else if (candidates.length === 1) matchStatus = "matched";
      else if (candidates.length > 1) matchStatus = "ambiguous";
      group = {
        proposed: row.proposedMandal,
        sourceLabels: [],
        derivedFromSuffix: row.derivedMandalFromSuffix,
        matchStatus,
        mandalId: approval?.mandalId ?? (candidates.length === 1 ? candidates[0]!.id : null),
        mandalName: approval?.mandalId
          ? mandals.find((item) => item.id === approval.mandalId)?.name ?? null
          : candidates.length === 1
            ? candidates[0]!.name
            : null,
        candidates,
        approved: Boolean(approval?.approved),
        gpCount: 0
      };
      grouped.set(key, group);
    }
    if (!group.sourceLabels.includes(row.sourceMandal)) group.sourceLabels.push(row.sourceMandal);
    group.gpCount += 1;
    group.derivedFromSuffix = group.derivedFromSuffix || row.derivedMandalFromSuffix;
  }
  return [...grouped.values()];
}

export function approveMandalMapping(
  db: Database.Database,
  sessionId: string,
  proposed: string,
  mandalId: string | null
): ReservationImportSession {
  const session = getSession(sessionId);
  const key = fold(proposed);
  if (mandalId) {
    const found = listMandals(db).find((item) => item.id === mandalId);
    if (!found) throw new AppError("not_found", "Mandal not found.");
  }
  session.mandalApprovals[key] = { mandalId, approved: true };
  restage(session, db);
  return publicSession(session);
}

function restage(session: ReservationImportSession, db?: Database.Database): void {
  if (!session.preview) {
    session.staged = [];
    return;
  }
  const drafts = draftsFromPreview(session.preview);
  const gps = db
    ? (db
        .prepare(
          `SELECT gp.id, gp.name, gp.mandal_id, m.name AS mandal_name
           FROM gram_panchayats gp JOIN mandals m ON m.id = gp.mandal_id WHERE gp.archived = 0`
        )
        .all() as Array<{ id: string; name: string; mandal_id: string; mandal_name: string }>)
    : [];
  const wards = db
    ? (db
        .prepare(
          `SELECT id, gram_panchayat_id, ward_number, boundary_version_id FROM wards
           WHERE classification = 'rural' AND archived = 0`
        )
        .all() as Array<{
        id: string;
        gram_panchayat_id: string;
        ward_number: string;
        boundary_version_id: string;
      }>)
    : [];
  const election = db && session.electionId
    ? (db.prepare("SELECT * FROM elections WHERE id = ?").get(session.electionId) as Record<string, unknown> | undefined)
    : undefined;
  const boundaryId = election ? String(election.boundary_version_id) : "";
  const scope = db && election ? resolveScope(db, session.constituencyId, boundaryId) : null;
  const proposals = mandalProposals(session, db);
  const staged: ReservationStagedRow[] = drafts.map((draft) => {
    const issues = [...draft.issues];
    const proposal = proposals.find((item) => fold(item.proposed) === fold(draft.proposedMandal));
    let reviewStatus: ReservationReviewStatus = "pending";
    let mandalId: string | null = null;
    let gramPanchayatId: string | null = null;
    let wardId: string | null = null;
    if (draft.category === "not_recorded") reviewStatus = "not_recorded";
    else if (draft.category === "unknown") reviewStatus = "invalid_category";
    if (!proposal?.approved) {
      if (reviewStatus === "pending") reviewStatus = "mandal_needs_review";
      issues.push(
        proposal?.derivedFromSuffix
          ? `Source mandal "${draft.sourceMandal}" is treated as "${draft.proposedMandal}" only after review. A separate mandal is not created for the suffix.`
          : `Mandal "${draft.proposedMandal}" has not been approved.`
      );
    } else {
      mandalId = proposal.mandalId;
      if (!mandalId) {
        reviewStatus = "unmatched";
        issues.push(`Proposed mandal "${draft.proposedMandal}" is not matched to geography.`);
      } else {
        const gpMatches = gps.filter((gp) => gp.mandal_id === mandalId && fold(gp.name) === fold(draft.sourceGp));
        if (gpMatches.length === 1) {
          gramPanchayatId = gpMatches[0]!.id;
          if (scope && !scope.gramPanchayats[gramPanchayatId] && !scope.mandals[mandalId]) {
            reviewStatus = "outside_coverage";
            issues.push("This Gram Panchayat is not in the selected constituency coverage.");
          }
        } else if (gpMatches.length > 1) {
          reviewStatus = "ambiguous";
          issues.push(`Gram Panchayat "${draft.sourceGp}" matches more than one record in ${draft.proposedMandal}.`);
        } else {
          reviewStatus = "unmatched";
          issues.push(`Gram Panchayat "${draft.sourceGp}" was not found in ${draft.proposedMandal}.`);
        }
      }
    }
    if (draft.seatType === "ward_member" && gramPanchayatId && db && election) {
      const matches = wards.filter(
        (ward) => ward.gram_panchayat_id === gramPanchayatId && ward.ward_number === draft.sourceWardNumber
      );
      const inBoundary = matches.filter((ward) => ward.boundary_version_id === boundaryId);
      if (!matches.length) {
        reviewStatus = "missing_ward";
        issues.push(
          `Ward ${draft.sourceWardNumber} was not found under this Gram Panchayat. Ward number alone is never used to match.`
        );
      } else if (!inBoundary.length) {
        reviewStatus = "boundary_mismatch";
        issues.push(`Ward ${draft.sourceWardNumber} exists on a different boundary version.`);
      } else if (inBoundary.length > 1) {
        reviewStatus = "ambiguous";
        issues.push(`Ward ${draft.sourceWardNumber} is ambiguous under this Gram Panchayat and boundary.`);
      } else {
        wardId = inBoundary[0]!.id;
        if (scope && !scope.ruralWards[wardId]) {
          reviewStatus = "outside_coverage";
          issues.push("This ward is not in the selected constituency coverage.");
        }
      }
    }
    const blocking =
      reviewStatus === "mandal_needs_review" ||
      reviewStatus === "unmatched" ||
      reviewStatus === "ambiguous" ||
      reviewStatus === "missing_ward" ||
      reviewStatus === "outside_coverage" ||
      reviewStatus === "boundary_mismatch" ||
      reviewStatus === "invalid_category" ||
      reviewStatus === "not_recorded";
    const mappedOk =
      Boolean(gramPanchayatId) &&
      (draft.seatType === "sarpanch" || Boolean(wardId)) &&
      draft.category !== "unknown" &&
      draft.category !== "not_recorded" &&
      reviewStatus !== "outside_coverage" &&
      reviewStatus !== "boundary_mismatch" &&
      reviewStatus !== "ambiguous";
    if (mappedOk) reviewStatus = "mapped";
    return {
      draft,
      reviewStatus,
      mandalId,
      gramPanchayatId,
      wardId,
      issues,
      importable: mappedOk && !blocking
    };
  });
  for (const row of staged) {
    if (row.reviewStatus !== "mapped") continue;
    const clash = staged.filter(
      (other) =>
        other !== row &&
        other.reviewStatus === "mapped" &&
        other.draft.seatType === row.draft.seatType &&
        ((row.draft.seatType === "sarpanch" && other.gramPanchayatId === row.gramPanchayatId) ||
          (row.draft.seatType === "ward_member" && other.wardId && other.wardId === row.wardId))
    );
    if (clash.length) {
      row.reviewStatus = "conflict";
      row.importable = false;
      row.issues.push("Conflicting assignment for the same seat in this notification.");
    }
  }
  session.staged = staged;
  session.eligibleCount = staged.filter((row) => row.importable).length;
  session.unresolvedCount = staged.filter((row) => !row.importable && row.reviewStatus !== "excluded").length;
  session.excludedCount = staged.filter((row) => row.reviewStatus === "excluded").length;
  session.geoPlan = buildGeoPlan(session);
}

function buildGeoPlan(session: ReservationImportSession): ReservationGeoCreatePlan {
  const mandals: ReservationGeoCreatePlan["mandals"] = [];
  const gramPanchayats: ReservationGeoCreatePlan["gramPanchayats"] = [];
  const wards: ReservationGeoCreatePlan["wards"] = [];
  const seenMandal = new Set<string>();
  const seenGp = new Set<string>();
  const seenWard = new Set<string>();
  for (const row of session.staged) {
    const proposalKey = fold(row.draft.proposedMandal);
    const approved = session.mandalApprovals[proposalKey];
    if (!row.mandalId && approved?.approved && !seenMandal.has(proposalKey)) {
      seenMandal.add(proposalKey);
      mandals.push({
        name: row.draft.proposedMandal,
        sourceLabels: [...new Set(session.staged.filter((item) => fold(item.draft.proposedMandal) === proposalKey).map((item) => item.draft.sourceMandal))]
      });
    }
    if (row.mandalId && !row.gramPanchayatId && row.reviewStatus === "unmatched") {
      const key = `${row.mandalId}||${fold(row.draft.sourceGp)}`;
      if (!seenGp.has(key)) {
        seenGp.add(key);
        gramPanchayats.push({ mandalName: row.draft.proposedMandal, name: row.draft.sourceGp });
      }
    }
    if (row.gramPanchayatId && row.draft.seatType === "ward_member" && !row.wardId && row.reviewStatus === "missing_ward") {
      const key = `${row.gramPanchayatId}||${row.draft.sourceWardNumber}`;
      if (!seenWard.has(key)) {
        seenWard.add(key);
        wards.push({
          mandalName: row.draft.proposedMandal,
          gpName: row.draft.sourceGp,
          wardNumber: row.draft.sourceWardNumber
        });
      }
    }
  }
  return { mandals, gramPanchayats, wards };
}

export function createReviewedGeography(
  db: Database.Database,
  sessionId: string,
  confirm: boolean
): ReservationImportSession {
  const session = getSession(sessionId);
  if (!session.electionId) throw new AppError("validation", "Select an election workspace first.");
  restage(session, db);
  const plan = session.geoPlan;
  if (!plan) throw new AppError("validation", "Review geography before creating units.");
  if (!confirm) return publicSession(session);
  const election = db.prepare("SELECT * FROM elections WHERE id = ?").get(session.electionId) as Record<string, unknown>;
  const boundaryId = String(election.boundary_version_id);
  const tx = db.transaction(() => {
    const mandalIds = new Map<string, string>();
    for (const item of plan.mandals) {
      const created = createMandal(db, {
        name: item.name,
        notes: "Created from reservation import review. No official code or constituency coverage was invented."
      });
      mandalIds.set(fold(item.name), created.id);
      session.mandalApprovals[fold(item.name)] = { mandalId: created.id, approved: true };
    }
    const gpIds = new Map<string, string>();
    for (const item of plan.gramPanchayats) {
      const mandalId =
        mandalIds.get(fold(item.mandalName)) ??
        session.mandalApprovals[fold(item.mandalName)]?.mandalId ??
        listMandals(db).find((row) => fold(row.name) === fold(item.mandalName))?.id;
      if (!mandalId) continue;
      const created = createGp(db, {
        mandalId,
        name: item.name,
        notes: "Created from reservation import review. No official code, village link or coverage was invented."
      });
      gpIds.set(`${fold(item.mandalName)}||${fold(item.name)}`, created.id);
    }
    restage(session, db);
    for (const item of plan.wards) {
      const gpId =
        gpIds.get(`${fold(item.mandalName)}||${fold(item.gpName)}`) ??
        session.staged.find(
          (row) => fold(row.draft.proposedMandal) === fold(item.mandalName) && fold(row.draft.sourceGp) === fold(item.gpName)
        )?.gramPanchayatId;
      if (!gpId) continue;
      createWard(db, {
        classification: "rural",
        gramPanchayatId: gpId,
        boundaryVersionId: boundaryId,
        wardNumber: item.wardNumber,
        name: `Ward ${item.wardNumber}`,
        recordSource: "reservation-import-review",
        notes: "Created from reservation import review. No official code or coverage was invented."
      });
    }
  });
  tx();
  restage(session, db);
  return publicSession(session);
}

export function reservationSetPartial(sessionId: string, allowPartial: boolean): ReservationImportSession {
  const session = getSession(sessionId);
  session.allowPartial = allowPartial;
  return publicSession(session);
}

function history(
  db: Database.Database,
  seatId: string,
  notificationId: string,
  action: string,
  notes: string,
  fields: string[]
): void {
  db.prepare(
    `INSERT INTO reservation_review_history (id, seat_id, notification_id, changed_at, action, notes, field_names)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(newId(), seatId, notificationId, nowIso(), action, notes, JSON.stringify(fields));
}

export function commitReservationImport(
  db: Database.Database,
  sessionId: string,
  allowPartial = false
): ReservationCommitResult {
  const session = getSession(sessionId);
  if (!session.preview || !session.electionId || !session.notificationId) {
    throw new AppError("validation", "Select an election and notification, then validate geography before import.");
  }
  restage(session, db);
  const eligible = session.staged.filter((row) => row.importable);
  if (eligible.length === 0) {
    throw new AppError(
      "import_invalid",
      "No importable reservation records. Approve mandal mappings and resolve unmatched geography first."
    );
  }
  if (session.unresolvedCount > 0 && !allowPartial && !session.allowPartial) {
    throw new AppError(
      "import_invalid",
      "Unresolved rows remain. Confirm a partial import to keep them in the review queue, or resolve them first."
    );
  }
  const note = db.prepare("SELECT * FROM reservation_notifications WHERE id = ?").get(session.notificationId) as Record<
    string,
    unknown
  >;
  const existing = db
    .prepare(
      "SELECT id FROM reservation_import_batches WHERE notification_id = ? AND fingerprint = ? AND status = 'committed'"
    )
    .get(session.notificationId, session.preview.fingerprint) as { id: string } | undefined;
  if (existing) {
    throw new AppError(
      "import_repeated",
      "This reservation worksheet was already imported into this notification. Earlier versions are kept; start a new notification to record a revision."
    );
  }
  const batchId = newId();
  const ts = nowIso();
  const toWrite = allowPartial || session.allowPartial ? session.staged.filter((row) => row.importable || row.reviewStatus !== "excluded") : session.staged;
  let imported = 0;
  let unresolved = 0;
  let excluded = 0;
  let conflicting = 0;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO reservation_import_batches (
        id, notification_id, constituency_id, file_name, fingerprint, worksheet_name, source_year,
        row_count, status, district_source, created_at, committed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'committed', ?, ?, ?)`
    ).run(
      batchId,
      session.notificationId,
      session.constituencyId,
      session.preview!.fileName,
      session.preview!.fingerprint,
      session.preview!.worksheetName,
      session.preview!.year,
      toWrite.length,
      session.preview!.districtSource,
      ts,
      ts
    );
    db.prepare("UPDATE reservation_notifications SET district_source = ?, updated_at = ? WHERE id = ?").run(
      session.preview!.districtSource,
      ts,
      session.notificationId
    );
    const insert = db.prepare(
      `INSERT INTO seat_reservations (
        id, notification_id, import_batch_id, election_id, year, seat_type, gram_panchayat_id, ward_id,
        source_mandal_label, source_gp_label, source_ward_number, declared_ward_count, original_code, category,
        women_reserved, review_status, source_filename, source_worksheet, source_row, source_cell,
        verification_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
    );
    for (const row of toWrite) {
      const id = newId();
      try {
        insert.run(
          id,
          session.notificationId,
          batchId,
          session.electionId,
          session.preview!.year ?? Number(note.year),
          row.draft.seatType,
          row.gramPanchayatId,
          row.draft.seatType === "ward_member" ? row.wardId : null,
          row.draft.sourceMandal,
          row.draft.sourceGp,
          row.draft.sourceWardNumber,
          row.draft.declaredWardCount,
          row.draft.originalCode,
          row.draft.category,
          row.draft.womenReserved ? 1 : 0,
          row.reviewStatus,
          session.preview!.fileName,
          session.preview!.worksheetName,
          row.draft.sourceRow,
          row.draft.sourceCell,
          ts,
          ts
        );
      } catch (error) {
        throw new AppError(
          "import_invalid",
          "A conflicting seat already exists in this notification. Earlier records were not overwritten."
        );
      }
      history(
        db,
        id,
        session.notificationId!,
        "import",
        row.importable ? "Imported from reservation worksheet." : "Retained in review queue.",
        ["originalCode", "reviewStatus"]
      );
      if (row.importable) imported += 1;
      else if (row.reviewStatus === "excluded") excluded += 1;
      else if (row.reviewStatus === "conflict") conflicting += 1;
      else unresolved += 1;
    }
    writeAudit(db, {
      action: "create",
      entityType: "reservation_import_batch",
      recordId: batchId,
      changedFields: ["fingerprint", "row_count"]
    });
  });
  try {
    tx();
  } catch (error) {
    throw error;
  }
  sessions.delete(sessionId);
  return { imported, unresolved, excluded, conflicting, batchId, notificationId: session.notificationId };
}

export function cancelReservationImport(sessionId: string): void {
  sessions.delete(sessionId);
}

export function listReservationSeats(
  db: Database.Database,
  input: {
    constituencyId: string;
    notificationId?: string;
    electionId?: string;
    year?: number;
    mandalId?: string;
    gramPanchayatId?: string;
    category?: string;
    womenReserved?: boolean | "";
    reviewStatus?: string;
    seatType?: ReservationSeatType | "";
    page?: number;
    pageSize?: number;
  }
): PagedResult<ReservationSeat> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const where = ["n.constituency_id = ?"];
  const params: unknown[] = [input.constituencyId];
  if (input.notificationId) {
    where.push("s.notification_id = ?");
    params.push(input.notificationId);
  }
  if (input.electionId) {
    where.push("s.election_id = ?");
    params.push(input.electionId);
  }
  if (input.year) {
    where.push("s.year = ?");
    params.push(input.year);
  }
  if (input.gramPanchayatId) {
    where.push("s.gram_panchayat_id = ?");
    params.push(input.gramPanchayatId);
  }
  if (input.mandalId) {
    where.push("gp.mandal_id = ?");
    params.push(input.mandalId);
  }
  if (input.category) {
    where.push("s.category = ?");
    params.push(input.category);
  }
  if (input.womenReserved === true) where.push("s.women_reserved = 1");
  if (input.womenReserved === false) where.push("s.women_reserved = 0");
  if (input.reviewStatus) {
    where.push("s.review_status = ?");
    params.push(input.reviewStatus);
  }
  if (input.seatType) {
    where.push("s.seat_type = ?");
    params.push(input.seatType);
  }
  const sql = `FROM seat_reservations s
    JOIN reservation_notifications n ON n.id = s.notification_id
    LEFT JOIN gram_panchayats gp ON gp.id = s.gram_panchayat_id
    LEFT JOIN mandals m ON m.id = gp.mandal_id
    LEFT JOIN wards w ON w.id = s.ward_id
    WHERE ${where.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) AS c ${sql}`).get(...params) as { c: number }).c;
  const items = db
    .prepare(
      `SELECT s.*, gp.name AS gp_name, m.name AS mandal_name, w.name AS ward_name
       ${sql} ORDER BY m.name, gp.name, s.seat_type, CAST(s.source_ward_number AS INTEGER)
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;
  return { items: items.map(mapSeat), total, page, pageSize };
}

export function reservationSummary(
  db: Database.Database,
  input: { constituencyId: string; notificationId?: string; electionId?: string }
): ReservationSummary {
  const notes = listReservationNotifications(db, input);
  const notification = input.notificationId ? notes.find((row) => row.id === input.notificationId) ?? null : notes[0] ?? null;
  const seats = listReservationSeats(db, { ...input, page: 1, pageSize: 10000 }).items;
  const sarpanchByCategory: Record<string, number> = {};
  const wardByCategory: Record<string, number> = {};
  const womenReservedBySeatType = { sarpanch: 0, ward_member: 0 };
  const mandalMap = new Map<string, { mandal: string; gps: Set<string>; sarpanch: number; wards: number }>();
  let unmapped = 0;
  let unverified = 0;
  let conflicting = 0;
  for (const seat of seats) {
    const bucket = seat.seatType === "sarpanch" ? sarpanchByCategory : wardByCategory;
    const label = seat.category === "not_recorded" ? "Not recorded" : seat.category === "unknown" ? "Unknown" : seat.originalCode || seat.category;
    bucket[label] = (bucket[label] ?? 0) + 1;
    if (seat.womenReserved) womenReservedBySeatType[seat.seatType] += 1;
    const mandal = seat.mandalName || proposeMandalLabel(seat.sourceMandalLabel).proposed;
    let entry = mandalMap.get(mandal);
    if (!entry) {
      entry = { mandal, gps: new Set(), sarpanch: 0, wards: 0 };
      mandalMap.set(mandal, entry);
    }
    entry.gps.add(seat.sourceGpLabel);
    if (seat.seatType === "sarpanch") entry.sarpanch += 1;
    else entry.wards += 1;
    if (!seat.gramPanchayatId || (seat.seatType === "ward_member" && !seat.wardId)) unmapped += 1;
    if (seat.reviewStatus !== "mapped" && notification?.status !== "verified") unverified += 1;
    if (seat.reviewStatus === "conflict") conflicting += 1;
  }
  return {
    notification,
    sarpanchByCategory,
    wardByCategory,
    womenReservedBySeatType,
    mandalTotals: [...mandalMap.values()].map((row) => ({
      mandal: row.mandal,
      gps: row.gps.size,
      sarpanch: row.sarpanch,
      wards: row.wards
    })),
    unmapped,
    unverified,
    conflicting,
    sourceWideNote:
      "Workbook-wide controls stay on the import review. These totals are imported records for the selected constituency and notification.",
    importedSarpanch: seats.filter((seat) => seat.seatType === "sarpanch").length,
    importedWardMembers: seats.filter((seat) => seat.seatType === "ward_member").length
  };
}

export function reservationMatrix(
  db: Database.Database,
  input: { constituencyId: string; notificationId: string }
): { wardNumbers: string[]; rows: ReservationMatrixRow[] } {
  const seats = listReservationSeats(db, { ...input, page: 1, pageSize: 20000 }).items;
  const wardNumbers = [
    ...new Set(
      seats
        .filter((seat) => seat.seatType === "ward_member" && seat.sourceWardNumber)
        .map((seat) => seat.sourceWardNumber)
    )
  ].sort((a, b) => Number(a) - Number(b));
  const byGp = new Map<string, ReservationMatrixRow>();
  for (const seat of seats) {
    const key = `${seat.sourceMandalLabel}||${seat.sourceGpLabel}`;
    let row = byGp.get(key);
    if (!row) {
      row = {
        mandal: seat.mandalName || proposeMandalLabel(seat.sourceMandalLabel).proposed,
        gramPanchayat: seat.gpName || seat.sourceGpLabel,
        gpId: seat.gramPanchayatId,
        sarpanchCode: "",
        sarpanchWomen: false,
        declaredWardCount: seat.declaredWardCount,
        wards: wardNumbers.map((num) => ({
          wardNumber: num,
          code: "",
          womenReserved: false,
          applicable: seat.declaredWardCount != null ? Number(num) <= seat.declaredWardCount : true,
          missing: false
        }))
      };
      byGp.set(key, row);
    }
    if (seat.seatType === "sarpanch") {
      row.sarpanchCode = seat.originalCode || (seat.category === "not_recorded" ? "Not recorded" : seat.category);
      row.sarpanchWomen = seat.womenReserved;
    } else {
      const cell = row.wards.find((item) => item.wardNumber === seat.sourceWardNumber);
      if (cell) {
        cell.applicable = true;
        cell.code = seat.originalCode || (seat.category === "not_recorded" ? "Not recorded" : seat.category);
        cell.womenReserved = seat.womenReserved;
        cell.missing = seat.category === "not_recorded";
      }
    }
  }
  for (const row of byGp.values()) {
    for (const cell of row.wards) {
      if (row.declaredWardCount != null && Number(cell.wardNumber) > row.declaredWardCount) {
        cell.applicable = false;
        cell.code = "";
        cell.missing = false;
      } else if (cell.applicable && !cell.code) {
        cell.missing = true;
      }
    }
  }
  return { wardNumbers, rows: [...byGp.values()] };
}

export function seatsForUnit(
  db: Database.Database,
  input: { constituencyId: string; electionId?: string; gramPanchayatId?: string; wardId?: string }
): ReservationSeat[] {
  if (!input.electionId) return [];
  const notes = listReservationNotifications(db, { constituencyId: input.constituencyId, electionId: input.electionId });
  const current = notes.find((row) => row.status !== "superseded") ?? notes[0];
  if (!current) return [];
  return listReservationSeats(db, {
    constituencyId: input.constituencyId,
    notificationId: current.id,
    gramPanchayatId: input.gramPanchayatId,
    page: 1,
    pageSize: 200
  }).items.filter((seat) => (input.wardId ? seat.wardId === input.wardId || seat.seatType === "sarpanch" : true));
}

export function verifyReservationNotification(
  db: Database.Database,
  input: { id: string; constituencyId: string; notificationReference: string; notes: string }
): ReservationNotification {
  const current = db.prepare("SELECT * FROM reservation_notifications WHERE id = ?").get(input.id) as
    | Record<string, unknown>
    | undefined;
  if (!current) throw new AppError("not_found", "Reservation notification not found.");
  if (String(current.constituency_id) !== input.constituencyId) {
    throw new AppError("constituency_isolation", "Notification is outside the selected constituency.");
  }
  if (!input.notificationReference.trim() || !input.notes.trim()) {
    throw new AppError(
      "validation",
      "Verification requires a notification reference and reviewer notes. WIN WIN does not declare official validity automatically."
    );
  }
  const ts = nowIso();
  db.prepare(
    `UPDATE reservation_notifications SET status = 'verified', notification_reference = ?, verified_at = ?, verified_notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(input.notificationReference.trim(), ts, input.notes.trim(), ts, input.id);
  writeAudit(db, {
    action: "update",
    entityType: "reservation_notification",
    recordId: input.id,
    changedFields: ["status", "notification_reference", "verified_notes"]
  });
  return listReservationNotifications(db, { constituencyId: input.constituencyId }).find((row) => row.id === input.id)!;
}

export function supersedeReservationNotification(
  db: Database.Database,
  input: { id: string; constituencyId: string }
): ReservationNotification {
  const current = db.prepare("SELECT * FROM reservation_notifications WHERE id = ?").get(input.id) as
    | Record<string, unknown>
    | undefined;
  if (!current) throw new AppError("not_found", "Reservation notification not found.");
  db.prepare("UPDATE reservation_notifications SET status = 'superseded', updated_at = ? WHERE id = ?").run(nowIso(), input.id);
  writeAudit(db, { action: "update", entityType: "reservation_notification", recordId: input.id, changedFields: ["status"] });
  return listReservationNotifications(db, { constituencyId: input.constituencyId }).find((row) => row.id === input.id)!;
}

export function reservationHistory(db: Database.Database, seatId: string): ReservationHistoryItem[] {
  const rows = db
    .prepare("SELECT * FROM reservation_review_history WHERE seat_id = ? ORDER BY changed_at DESC")
    .all(seatId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    seatId: String(row.seat_id),
    notificationId: String(row.notification_id),
    changedAt: String(row.changed_at),
    action: String(row.action),
    notes: String(row.notes ?? ""),
    fieldNames: JSON.parse(String(row.field_names ?? "[]")) as string[]
  }));
}

export function exportReservationCsv(
  db: Database.Database,
  input: {
    constituencyId: string;
    notificationId: string;
    kind: "sarpanch" | "ward_member" | "matrix" | "review";
  }
): string {
  if (input.kind === "matrix") {
    const matrix = reservationMatrix(db, input);
    const header = ["mandal", "gram_panchayat", "sarpanch", "ward_count", ...matrix.wardNumbers.map((n) => `ward_${n}`)];
    const rows = matrix.rows.map((row) => [
      row.mandal,
      row.gramPanchayat,
      row.sarpanchCode,
      row.declaredWardCount == null ? "" : String(row.declaredWardCount),
      ...row.wards.map((cell) => (cell.applicable ? cell.code || (cell.missing ? "Not recorded" : "") : "Not applicable"))
    ]);
    return stringifyCsv([header, ...rows].map((line) => line.map((cell) => guardSpreadsheetCell(cell))));
  }
  const seats = listReservationSeats(db, {
    constituencyId: input.constituencyId,
    notificationId: input.notificationId,
    seatType: input.kind === "review" ? "" : input.kind,
    page: 1,
    pageSize: 20000
  }).items.filter((seat) => (input.kind === "review" ? seat.reviewStatus !== "mapped" : true));
  const header = [
    "seat_type",
    "source_mandal",
    "source_gp",
    "ward_number",
    "original_code",
    "category",
    "women_reserved",
    "review_status",
    "source_file",
    "source_sheet",
    "source_row",
    "source_cell"
  ];
  const rows = seats.map((seat) => [
    seat.seatType,
    seat.sourceMandalLabel,
    seat.sourceGpLabel,
    seat.sourceWardNumber,
    seat.originalCode,
    seat.category,
    seat.womenReserved ? "yes" : "no",
    seat.reviewStatus,
    seat.sourceFilename,
    seat.sourceWorksheet,
    seat.sourceRow == null ? "" : String(seat.sourceRow),
    seat.sourceCell
  ]);
  return stringifyCsv([header, ...rows].map((line) => line.map((cell) => guardSpreadsheetCell(cell))));
}

export async function exportReservationXlsx(
  db: Database.Database,
  input: Parameters<typeof exportReservationCsv>[1]
): Promise<Buffer> {
  const csv = exportReservationCsv(db, input);
  const lines = csv.replace(/^\uFEFF/, "").split(/\r\n/);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(input.kind);
  for (const line of lines) {
    if (!line) continue;
    const row: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        row.push(field);
        field = "";
      } else field += ch;
    }
    row.push(field);
    sheet.addRow(row);
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function reservationSessionView(sessionId: string, db?: Database.Database): ReservationImportSession {
  const session = getSession(sessionId);
  if (db) restage(session, db);
  return { ...publicSession(session), geoPlan: session.geoPlan };
}

export function clearReservationSessions(): void {
  sessions.clear();
}

export { mandalProposals as listMandalProposals };
export function sessionMandalProposals(sessionId: string, db: Database.Database): ReservationMandalProposal[] {
  return mandalProposals(getSession(sessionId), db);
}
