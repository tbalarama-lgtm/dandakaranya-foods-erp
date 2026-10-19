import type Database from "better-sqlite3";
import { localDateString } from "@shared/dates";
import type {
  ActivityItem,
  DashboardWorkItem,
  GeoDashboard,
  GeoDashboardLevel,
  GeoDashboardQuery,
  GeoDirectory,
  GeoDirectoryRow,
  GeoMetric,
  GeoReservationSnapshot,
  GeoReviewItem,
  GeoTeamMember,
  ResolvedScope
} from "@shared/types";
import { AppError } from "../errors";
import { resolveScope } from "./coverage";

const OPEN_ISSUES = "('open','in_progress')";
const OPEN_TASKS = "('open','in_progress')";

function inSql(ids: string[]): string {
  return ids.map(() => "?").join(",");
}

function countSql(db: Database.Database, sql: string, params: unknown[]): number {
  return (db.prepare(sql).get(...params) as { c: number }).c;
}

function filterActive(
  db: Database.Database,
  table: string,
  ids: string[],
  includeArchived: boolean
): string[] {
  if (!ids.length) return [];
  const rows = db
    .prepare(
      `SELECT id FROM ${table} WHERE id IN (${inSql(ids)})${includeArchived ? "" : " AND archived = 0"}`
    )
    .all(...ids) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

function named(
  db: Database.Database,
  table: string,
  id: string
): { id: string; name: string; name_te: string } | undefined {
  return db.prepare(`SELECT id, name, name_te FROM ${table} WHERE id = ?`).get(id) as
    | { id: string; name: string; name_te: string }
    | undefined;
}

function qs(parts: Record<string, string | undefined>): string {
  const entries = Object.entries(parts).filter(([, value]) => value);
  if (!entries.length) return "";
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`).join("&")}`;
}

function contextQuery(input: GeoDashboardQuery, extra?: Record<string, string | undefined>): string {
  return qs({
    election: input.electionId,
    edition: input.rollEditionId,
    notification: input.notificationId,
    ...extra
  });
}

interface ScopedIds {
  mandalIds: string[];
  gpIds: string[];
  villageIds: string[];
  ulbIds: string[];
  ruralWardIds: string[];
  urbanWardIds: string[];
  allWardIds: string[];
}

function scopedIds(
  db: Database.Database,
  scope: ResolvedScope,
  input: GeoDashboardQuery
): ScopedIds {
  const includeArchived = Boolean(input.includeArchived);
  const allMandals = filterActive(db, "mandals", Object.keys(scope.mandals), includeArchived);
  const allGps = filterActive(db, "gram_panchayats", Object.keys(scope.gramPanchayats), includeArchived);
  const allVillages = filterActive(db, "villages", Object.keys(scope.villages), includeArchived);
  const allUlbs = filterActive(db, "urban_local_bodies", Object.keys(scope.urbanLocalBodies), includeArchived);
  const allRural = filterActive(db, "wards", Object.keys(scope.ruralWards), includeArchived);
  const allUrban = filterActive(db, "wards", Object.keys(scope.urbanWards), includeArchived);

  if (input.level === "assembly") {
    return {
      mandalIds: allMandals,
      gpIds: allGps,
      villageIds: allVillages,
      ulbIds: allUlbs,
      ruralWardIds: allRural,
      urbanWardIds: allUrban,
      allWardIds: [...allRural, ...allUrban]
    };
  }

  if (!input.unitId) throw new AppError("validation", "A geographic unit is required for this dashboard.");

  if (input.level === "mandal") {
    if (!scope.mandals[input.unitId]) {
      throw new AppError("isolation", "This mandal is not in the selected constituency coverage.");
    }
    const gpRows = allGps.length
      ? (db
          .prepare(
            `SELECT id FROM gram_panchayats WHERE mandal_id = ? AND id IN (${inSql(allGps)})`
          )
          .all(input.unitId, ...allGps) as Array<{ id: string }>)
      : [];
    const gpIds = gpRows.map((row) => row.id);
    const villageIds = villagesForGps(db, gpIds, allVillages);
    const ruralWardIds = ruralWardsForGps(db, gpIds, allRural, input.boundaryVersionId);
    return {
      mandalIds: [input.unitId],
      gpIds,
      villageIds,
      ulbIds: [],
      ruralWardIds,
      urbanWardIds: [],
      allWardIds: ruralWardIds
    };
  }

  if (input.level === "gram_panchayat") {
    if (!scope.gramPanchayats[input.unitId]) {
      throw new AppError("isolation", "This Gram Panchayat is not in the selected constituency coverage.");
    }
    const gpIds = [input.unitId];
    const villageIds = villagesForGps(db, gpIds, allVillages);
    const ruralWardIds = ruralWardsForGps(db, gpIds, allRural, input.boundaryVersionId);
    const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(input.unitId) as
      | { mandal_id: string }
      | undefined;
    return {
      mandalIds: gp ? [gp.mandal_id] : [],
      gpIds,
      villageIds,
      ulbIds: [],
      ruralWardIds,
      urbanWardIds: [],
      allWardIds: ruralWardIds
    };
  }

  if (input.level === "urban_local_body") {
    if (!scope.urbanLocalBodies[input.unitId]) {
      throw new AppError("isolation", "This urban local body is not in the selected constituency coverage.");
    }
    const urbanWardIds = allUrban.length
      ? (
          db
            .prepare(
              `SELECT id FROM wards WHERE urban_local_body_id = ? AND classification = 'urban'
               AND boundary_version_id = ? AND id IN (${inSql(allUrban)})`
            )
            .all(input.unitId, input.boundaryVersionId, ...allUrban) as Array<{ id: string }>
        ).map((row) => row.id)
      : [];
    return {
      mandalIds: [],
      gpIds: [],
      villageIds: [],
      ulbIds: [input.unitId],
      ruralWardIds: [],
      urbanWardIds,
      allWardIds: urbanWardIds
    };
  }

  const isRural = input.level === "rural_ward";
  const map = isRural ? scope.ruralWards : scope.urbanWards;
  if (!map[input.unitId]) {
    throw new AppError("isolation", "This ward is not in the selected constituency coverage.");
  }
  const ward = db
    .prepare("SELECT gram_panchayat_id, urban_local_body_id FROM wards WHERE id = ?")
    .get(input.unitId) as { gram_panchayat_id: string | null; urban_local_body_id: string | null } | undefined;
  const villageIds =
    isRural && ward?.gram_panchayat_id
      ? villagesLinkedToWard(db, input.unitId, allVillages)
      : [];
  return {
    mandalIds: [],
    gpIds: ward?.gram_panchayat_id ? [ward.gram_panchayat_id] : [],
    villageIds,
    ulbIds: ward?.urban_local_body_id ? [ward.urban_local_body_id] : [],
    ruralWardIds: isRural ? [input.unitId] : [],
    urbanWardIds: isRural ? [] : [input.unitId],
    allWardIds: [input.unitId]
  };
}

function villagesForGps(db: Database.Database, gpIds: string[], allowed: string[]): string[] {
  if (!gpIds.length || !allowed.length) return [];
  return (
    db
      .prepare(
        `SELECT id FROM villages WHERE gram_panchayat_id IN (${inSql(gpIds)}) AND id IN (${inSql(allowed)})`
      )
      .all(...gpIds, ...allowed) as Array<{ id: string }>
  ).map((row) => row.id);
}

function ruralWardsForGps(
  db: Database.Database,
  gpIds: string[],
  allowed: string[],
  boundaryVersionId: string
): string[] {
  if (!gpIds.length || !allowed.length) return [];
  return (
    db
      .prepare(
        `SELECT id FROM wards WHERE classification = 'rural' AND boundary_version_id = ?
         AND gram_panchayat_id IN (${inSql(gpIds)}) AND id IN (${inSql(allowed)})`
      )
      .all(boundaryVersionId, ...gpIds, ...allowed) as Array<{ id: string }>
  ).map((row) => row.id);
}

function villagesLinkedToWard(db: Database.Database, wardId: string, allowed: string[]): string[] {
  if (!allowed.length) return [];
  return (
    db
      .prepare(
        `SELECT DISTINCT village_id AS id FROM village_ward_mappings
         WHERE ward_id = ? AND village_id IN (${inSql(allowed)})`
      )
      .all(wardId, ...allowed) as Array<{ id: string }>
  ).map((row) => row.id);
}

function metric(
  key: string,
  label: string,
  value: number | null,
  href: string,
  hint: string,
  missing = false
): GeoMetric {
  return { key, label, value, href, hint, missing };
}

function workLists(
  db: Database.Database,
  constituencyId: string,
  wardIds: string[]
): { overdueTasks: DashboardWorkItem[]; unresolvedIssues: DashboardWorkItem[] } {
  const today = localDateString();
  if (!wardIds.length) return { overdueTasks: [], unresolvedIssues: [] };
  const overdueTasks = (
    db
      .prepare(
        `SELECT DISTINCT t.id, t.title, t.due_date, t.status, t.ward_id, w.name AS ward_name
         FROM tasks t JOIN wards w ON w.id = t.ward_id
         WHERE t.constituency_id = ? AND t.archived = 0 AND t.status IN ${OPEN_TASKS}
           AND t.due_date IS NOT NULL AND t.due_date < ?
           AND t.ward_id IN (${inSql(wardIds)})
         ORDER BY t.due_date, t.updated_at DESC LIMIT 12`
      )
      .all(constituencyId, today, ...wardIds) as Array<{
      id: string;
      title: string;
      due_date: string;
      status: string;
      ward_id: string;
      ward_name: string;
    }>
  ).map(
    (row): DashboardWorkItem => ({
      id: row.id,
      title: row.title,
      wardId: row.ward_id,
      wardName: row.ward_name,
      href: `/wards/${row.ward_id}/tasks`,
      dueDate: row.due_date,
      status: row.status
    })
  );
  const unresolvedIssues = (
    db
      .prepare(
        `SELECT DISTINCT i.id, i.title, i.status, i.reference_number, i.ward_id, w.name AS ward_name
         FROM issues i JOIN wards w ON w.id = i.ward_id
         WHERE i.constituency_id = ? AND i.archived = 0 AND i.status IN ${OPEN_ISSUES}
           AND i.ward_id IN (${inSql(wardIds)})
         ORDER BY i.updated_at DESC LIMIT 12`
      )
      .all(constituencyId, ...wardIds) as Array<{
      id: string;
      title: string;
      status: string;
      reference_number: string;
      ward_id: string;
      ward_name: string;
    }>
  ).map(
    (row): DashboardWorkItem => ({
      id: row.id,
      title: row.title,
      wardId: row.ward_id,
      wardName: row.ward_name,
      href: `/wards/${row.ward_id}/issues`,
      status: row.status,
      referenceNumber: row.reference_number
    })
  );
  return { overdueTasks, unresolvedIssues };
}

function recentActivity(
  db: Database.Database,
  constituencyId: string,
  wardIds: string[]
): ActivityItem[] {
  if (!wardIds.length) return [];
  const recent: ActivityItem[] = [];
  const contacts = db
    .prepare(
      `SELECT c.id, c.updated_at, c.ward_id, w.name AS ward_name, p.name
       FROM ward_contact_links c
       JOIN wards w ON w.id = c.ward_id
       JOIN persons p ON p.id = c.person_id
       WHERE c.constituency_id = ? AND c.ward_id IN (${inSql(wardIds)})
       ORDER BY c.updated_at DESC LIMIT 8`
    )
    .all(constituencyId, ...wardIds) as Array<{
    id: string;
    updated_at: string;
    ward_id: string;
    ward_name: string;
    name: string;
  }>;
  for (const row of contacts) {
    recent.push({
      at: row.updated_at,
      kind: "contact",
      action: "Recorded contact",
      record: row.name,
      summary: `Recorded contact · ${row.name}`,
      recordId: row.id,
      wardId: row.ward_id,
      wardName: row.ward_name,
      href: `/wards/${row.ward_id}/contacts`
    });
  }
  const team = db
    .prepare(
      `SELECT a.id, a.updated_at, a.ward_id, w.name AS ward_name, p.name
       FROM team_assignments a
       JOIN wards w ON w.id = a.ward_id
       JOIN persons p ON p.id = a.person_id
       WHERE a.constituency_id = ? AND a.ward_id IN (${inSql(wardIds)})
       ORDER BY a.updated_at DESC LIMIT 8`
    )
    .all(constituencyId, ...wardIds) as Array<{
    id: string;
    updated_at: string;
    ward_id: string;
    ward_name: string;
    name: string;
  }>;
  for (const row of team) {
    recent.push({
      at: row.updated_at,
      kind: "team",
      action: "Assigned team member",
      record: row.name,
      summary: `Assigned team member · ${row.name}`,
      recordId: row.id,
      wardId: row.ward_id,
      wardName: row.ward_name,
      href: `/wards/${row.ward_id}/team`
    });
  }
  const issues = db
    .prepare(
      `SELECT i.id, i.updated_at, i.title, i.reference_number, i.ward_id, w.name AS ward_name
       FROM issues i JOIN wards w ON w.id = i.ward_id
       WHERE i.constituency_id = ? AND i.ward_id IN (${inSql(wardIds)})
       ORDER BY i.updated_at DESC LIMIT 8`
    )
    .all(constituencyId, ...wardIds) as Array<{
    id: string;
    updated_at: string;
    title: string;
    reference_number: string;
    ward_id: string;
    ward_name: string;
  }>;
  for (const row of issues) {
    const record = `${row.reference_number} ${row.title}`;
    recent.push({
      at: row.updated_at,
      kind: "issue",
      action: "Logged issue",
      record,
      summary: `Logged issue · ${record}`,
      recordId: row.id,
      wardId: row.ward_id,
      wardName: row.ward_name,
      href: `/wards/${row.ward_id}/issues`
    });
  }
  const tasks = db
    .prepare(
      `SELECT t.id, t.updated_at, t.title, t.ward_id, w.name AS ward_name
       FROM tasks t JOIN wards w ON w.id = t.ward_id
       WHERE t.constituency_id = ? AND t.ward_id IN (${inSql(wardIds)})
       ORDER BY t.updated_at DESC LIMIT 8`
    )
    .all(constituencyId, ...wardIds) as Array<{
    id: string;
    updated_at: string;
    title: string;
    ward_id: string;
    ward_name: string;
  }>;
  for (const row of tasks) {
    recent.push({
      at: row.updated_at,
      kind: "task",
      action: "Updated task",
      record: row.title,
      summary: `Updated task · ${row.title}`,
      recordId: row.id,
      wardId: row.ward_id,
      wardName: row.ward_name,
      href: `/wards/${row.ward_id}/tasks`
    });
  }
  recent.sort((a, b) => (a.at < b.at ? 1 : -1));
  return recent.slice(0, 10);
}

function countsByWard(
  db: Database.Database,
  sql: string,
  params: unknown[]
): Map<string, number> {
  const map = new Map<string, number>();
  const rows = db.prepare(sql).all(...params) as Array<{ id: string; c: number }>;
  for (const row of rows) map.set(row.id, Number(row.c));
  return map;
}

function voterCounts(
  db: Database.Database,
  constituencyId: string,
  editionId: string | undefined,
  wardIds: string[],
  unassignedScope: boolean
): { total: number | null; unassigned: number | null; review: number; missing: boolean } {
  if (!editionId) {
    return { total: null, unassigned: null, review: 0, missing: true };
  }
  const edition = db.prepare("SELECT id, constituency_id FROM roll_editions WHERE id = ?").get(editionId) as
    | { id: string; constituency_id: string }
    | undefined;
  if (!edition || edition.constituency_id !== constituencyId) {
    throw new AppError("constituency_isolation", "Roll edition is outside the selected constituency.");
  }
  const assigned = wardIds.length
    ? countSql(
        db,
        `SELECT COUNT(DISTINCT id) AS c FROM voter_entries
         WHERE constituency_id = ? AND roll_edition_id = ? AND archived = 0 AND assigned_ward_id IN (${inSql(wardIds)})`,
        [constituencyId, editionId, ...wardIds]
      )
    : 0;
  const unassigned = unassignedScope
    ? countSql(
        db,
        `SELECT COUNT(DISTINCT id) AS c FROM voter_entries
         WHERE constituency_id = ? AND roll_edition_id = ? AND archived = 0 AND assigned_ward_id IS NULL`,
        [constituencyId, editionId]
      )
    : 0;
  const review = wardIds.length
    ? countSql(
        db,
        `SELECT COUNT(DISTINCT id) AS c FROM voter_entries
         WHERE constituency_id = ? AND roll_edition_id = ? AND archived = 0
           AND verification_status = 'needs_review' AND assigned_ward_id IN (${inSql(wardIds)})`,
        [constituencyId, editionId, ...wardIds]
      )
    : 0;
  return { total: assigned, unassigned, review, missing: false };
}

function issueCount(db: Database.Database, constituencyId: string, wardIds: string[]): number {
  if (!wardIds.length) return 0;
  return countSql(
    db,
    `SELECT COUNT(DISTINCT id) AS c FROM issues
     WHERE constituency_id = ? AND archived = 0 AND status IN ${OPEN_ISSUES} AND ward_id IN (${inSql(wardIds)})`,
    [constituencyId, ...wardIds]
  );
}

function overdueCount(db: Database.Database, constituencyId: string, wardIds: string[]): number {
  if (!wardIds.length) return 0;
  return countSql(
    db,
    `SELECT COUNT(DISTINCT id) AS c FROM tasks
     WHERE constituency_id = ? AND archived = 0 AND status IN ${OPEN_TASKS}
       AND due_date IS NOT NULL AND due_date < ? AND ward_id IN (${inSql(wardIds)})`,
    [constituencyId, localDateString(), ...wardIds]
  );
}

function openTaskCount(db: Database.Database, constituencyId: string, wardIds: string[]): number {
  if (!wardIds.length) return 0;
  return countSql(
    db,
    `SELECT COUNT(DISTINCT id) AS c FROM tasks
     WHERE constituency_id = ? AND archived = 0 AND status IN ${OPEN_TASKS} AND ward_id IN (${inSql(wardIds)})`,
    [constituencyId, ...wardIds]
  );
}

function reservationReviewCount(
  db: Database.Database,
  constituencyId: string,
  gpIds: string[],
  wardIds: string[],
  electionId?: string,
  notificationId?: string
): number {
  const clauses = ["n.constituency_id = ?", "n.status != 'superseded'", "s.review_status != 'mapped'"];
  const params: unknown[] = [constituencyId];
  if (electionId) {
    clauses.push("s.election_id = ?");
    params.push(electionId);
  }
  if (notificationId) {
    clauses.push("s.notification_id = ?");
    params.push(notificationId);
  }
  const geo: string[] = [];
  if (gpIds.length) {
    geo.push(`(s.seat_type = 'sarpanch' AND s.gram_panchayat_id IN (${inSql(gpIds)}))`);
    params.push(...gpIds);
  }
  if (wardIds.length) {
    geo.push(`(s.seat_type = 'ward_member' AND s.ward_id IN (${inSql(wardIds)}))`);
    params.push(...wardIds);
  }
  if (!geo.length) return 0;
  return countSql(
    db,
    `SELECT COUNT(DISTINCT s.id) AS c FROM seat_reservations s
     JOIN reservation_notifications n ON n.id = s.notification_id
     WHERE ${clauses.join(" AND ")} AND (${geo.join(" OR ")})`,
    params
  );
}

function reservationSnapshot(
  db: Database.Database,
  input: GeoDashboardQuery,
  gpIds: string[],
  wardIds: string[],
  urbanOnly: boolean
): GeoReservationSnapshot | null {
  if (urbanOnly) {
    if (!input.electionId) {
      return {
        applicable: false,
        message: "Select an election workspace to look for urban reservation records. Rural Sarpanch logic is not applied here.",
        sarpanchCode: null,
        sarpanchWomen: false,
        sarpanchReview: null,
        wardMemberByCode: {},
        awaitingReview: 0,
        notificationName: null
      };
    }
    const urbanSeats = wardIds.length
      ? countSql(
          db,
          `SELECT COUNT(DISTINCT s.id) AS c FROM seat_reservations s
           JOIN reservation_notifications n ON n.id = s.notification_id
           WHERE n.constituency_id = ? AND s.election_id = ? AND n.status != 'superseded'
             AND s.ward_id IN (${inSql(wardIds)})`,
          [input.constituencyId, input.electionId, ...wardIds]
        )
      : 0;
    if (!urbanSeats) {
      return {
        applicable: false,
        message: "No urban seat-reservation records exist for this local body in the selected election.",
        sarpanchCode: null,
        sarpanchWomen: false,
        sarpanchReview: null,
        wardMemberByCode: {},
        awaitingReview: 0,
        notificationName: null
      };
    }
  }
  if (!input.electionId) {
    return {
      applicable: false,
      message: "Select an election workspace to see reservation information. Nothing is treated as permanently current.",
      sarpanchCode: null,
      sarpanchWomen: false,
      sarpanchReview: null,
      wardMemberByCode: {},
      awaitingReview: 0,
      notificationName: null
    };
  }
  const note = input.notificationId
    ? (db
        .prepare("SELECT id, name FROM reservation_notifications WHERE id = ? AND constituency_id = ?")
        .get(input.notificationId, input.constituencyId) as { id: string; name: string } | undefined)
    : (db
        .prepare(
          `SELECT id, name FROM reservation_notifications
           WHERE constituency_id = ? AND election_id = ? AND status != 'superseded'
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(input.constituencyId, input.electionId) as { id: string; name: string } | undefined);
  if (!note) {
    return {
      applicable: true,
      message: "No reservation notification is recorded for this election.",
      sarpanchCode: null,
      sarpanchWomen: false,
      sarpanchReview: null,
      wardMemberByCode: {},
      awaitingReview: 0,
      notificationName: null
    };
  }
  const sarpanch = gpIds.length
    ? (db
        .prepare(
          `SELECT original_code, women_reserved, review_status FROM seat_reservations
           WHERE notification_id = ? AND seat_type = 'sarpanch' AND gram_panchayat_id IN (${inSql(gpIds)})
           LIMIT 1`
        )
        .get(note.id, ...gpIds) as { original_code: string; women_reserved: number; review_status: string } | undefined)
    : undefined;
  const wardRows = wardIds.length
    ? (db
        .prepare(
          `SELECT original_code, COUNT(DISTINCT id) AS c FROM seat_reservations
           WHERE notification_id = ? AND seat_type = 'ward_member' AND ward_id IN (${inSql(wardIds)})
           GROUP BY original_code`
        )
        .all(note.id, ...wardIds) as Array<{ original_code: string; c: number }>)
    : [];
  const wardMemberByCode: Record<string, number> = {};
  for (const row of wardRows) wardMemberByCode[row.original_code || "Not recorded"] = Number(row.c);
  return {
    applicable: true,
    message: "",
    sarpanchCode: sarpanch?.original_code ?? null,
    sarpanchWomen: Boolean(sarpanch?.women_reserved),
    sarpanchReview: sarpanch?.review_status ?? null,
    wardMemberByCode,
    awaitingReview: reservationReviewCount(db, input.constituencyId, gpIds, wardIds, input.electionId, note.id),
    notificationName: note.name
  };
}

function directoryFromNamed(
  key: string,
  title: string,
  placeholder: string,
  rows: Array<{ id: string; name: string; nameTe: string; href: string; subtitle?: string; extra?: Record<string, string | number | null> }>
): GeoDirectory {
  return {
    key,
    title,
    searchPlaceholder: placeholder,
    columns: [
      { key: "name", label: "Name" },
      ...(rows[0]?.extra
        ? Object.keys(rows[0].extra).map((col) => ({ key: col, label: col.replaceAll("_", " ") }))
        : [])
    ],
    rows: rows.map(
      (row): GeoDirectoryRow => ({
        id: row.id,
        name: row.name,
        nameTe: row.nameTe,
        href: row.href,
        subtitle: row.subtitle,
        values: row.extra ?? {}
      })
    )
  };
}

function gpComparison(
  db: Database.Database,
  input: GeoDashboardQuery,
  gpIds: string[],
  allowedRuralWardIds: string[],
  ctx: string
): GeoDirectory {
  if (!gpIds.length) {
    return {
      key: "gps",
      title: "Gram Panchayats",
      searchPlaceholder: "Search Gram Panchayat",
      columns: [
        { key: "wards", label: "Wards" },
        { key: "voters", label: "Voters" },
        { key: "issues", label: "Unresolved issues" },
        { key: "overdue", label: "Overdue tasks" },
        { key: "review", label: "Needs review" }
      ],
      rows: []
    };
  }
  const gps = db
    .prepare(
      `SELECT gp.id, gp.name, gp.name_te, m.name AS mandal_name
       FROM gram_panchayats gp JOIN mandals m ON m.id = gp.mandal_id
       WHERE gp.id IN (${inSql(gpIds)}) ORDER BY gp.name`
    )
    .all(...gpIds) as Array<{ id: string; name: string; name_te: string; mandal_name: string }>;
  const ruralIds = allowedRuralWardIds;
  const wardCount = new Map<string, number>();
  if (ruralIds.length) {
    const wardRows = db
      .prepare(
        `SELECT gram_panchayat_id AS id, COUNT(DISTINCT id) AS c FROM wards
         WHERE id IN (${inSql(ruralIds)}) GROUP BY gram_panchayat_id`
      )
      .all(...ruralIds) as Array<{ id: string; c: number }>;
    for (const row of wardRows) wardCount.set(row.id, Number(row.c));
  }
  const votersByGp = new Map<string, number>();
  const reviewByGp = new Map<string, number>();
  if (input.rollEditionId && ruralIds.length) {
    const voterRows = db
      .prepare(
        `SELECT w.gram_panchayat_id AS id, COUNT(DISTINCT v.id) AS c
         FROM voter_entries v JOIN wards w ON w.id = v.assigned_ward_id
         WHERE v.constituency_id = ? AND v.roll_edition_id = ? AND v.archived = 0
           AND v.assigned_ward_id IN (${inSql(ruralIds)})
         GROUP BY w.gram_panchayat_id`
      )
      .all(input.constituencyId, input.rollEditionId, ...ruralIds) as Array<{ id: string; c: number }>;
    for (const row of voterRows) votersByGp.set(row.id, Number(row.c));
    const reviewRows = db
      .prepare(
        `SELECT w.gram_panchayat_id AS id, COUNT(DISTINCT v.id) AS c
         FROM voter_entries v JOIN wards w ON w.id = v.assigned_ward_id
         WHERE v.constituency_id = ? AND v.roll_edition_id = ? AND v.archived = 0
           AND v.verification_status = 'needs_review' AND v.assigned_ward_id IN (${inSql(ruralIds)})
         GROUP BY w.gram_panchayat_id`
      )
      .all(input.constituencyId, input.rollEditionId, ...ruralIds) as Array<{ id: string; c: number }>;
    for (const row of reviewRows) reviewByGp.set(row.id, Number(row.c));
  }
  const issueByGp = ruralIds.length
    ? countsByWard(
        db,
        `SELECT w.gram_panchayat_id AS id, COUNT(DISTINCT i.id) AS c FROM issues i
         JOIN wards w ON w.id = i.ward_id
         WHERE i.constituency_id = ? AND i.archived = 0 AND i.status IN ${OPEN_ISSUES}
           AND i.ward_id IN (${inSql(ruralIds)}) GROUP BY w.gram_panchayat_id`,
        [input.constituencyId, ...ruralIds]
      )
    : new Map<string, number>();
  const overdueByGp = ruralIds.length
    ? countsByWard(
        db,
        `SELECT w.gram_panchayat_id AS id, COUNT(DISTINCT t.id) AS c FROM tasks t
         JOIN wards w ON w.id = t.ward_id
         WHERE t.constituency_id = ? AND t.archived = 0 AND t.status IN ${OPEN_TASKS}
           AND t.due_date IS NOT NULL AND t.due_date < ? AND t.ward_id IN (${inSql(ruralIds)})
         GROUP BY w.gram_panchayat_id`,
        [input.constituencyId, localDateString(), ...ruralIds]
      )
    : new Map<string, number>();
  const resReviewByGp = new Map<string, number>();
  if (gpIds.length) {
    const clauses = ["n.constituency_id = ?", "n.status != 'superseded'", "s.review_status != 'mapped'"];
    const params: unknown[] = [input.constituencyId];
    if (input.electionId) {
      clauses.push("s.election_id = ?");
      params.push(input.electionId);
    }
    const rows = db
      .prepare(
        `SELECT s.gram_panchayat_id AS id, COUNT(DISTINCT s.id) AS c
         FROM seat_reservations s JOIN reservation_notifications n ON n.id = s.notification_id
         WHERE ${clauses.join(" AND ")} AND s.gram_panchayat_id IN (${inSql(gpIds)})
         GROUP BY s.gram_panchayat_id`
      )
      .all(...params, ...gpIds) as Array<{ id: string; c: number }>;
    for (const row of rows) resReviewByGp.set(row.id, Number(row.c));
  }
  return {
    key: "gps",
    title: "Gram Panchayats",
    searchPlaceholder: "Search Gram Panchayat",
    columns: [
      { key: "wards", label: "Wards" },
      { key: "voters", label: "Selected-edition voters" },
      { key: "issues", label: "Unresolved issues" },
      { key: "overdue", label: "Overdue tasks" },
      { key: "review", label: "Needs review" }
    ],
    rows: gps.map((gp) => ({
      id: gp.id,
      name: gp.name,
      nameTe: gp.name_te,
      href: `/areas/gps/${gp.id}${ctx}`,
      subtitle: gp.mandal_name,
      values: {
        wards: wardCount.get(gp.id) ?? 0,
        voters: input.rollEditionId ? (votersByGp.get(gp.id) ?? 0) : null,
        issues: issueByGp.get(gp.id) ?? 0,
        overdue: overdueByGp.get(gp.id) ?? 0,
        review: (reviewByGp.get(gp.id) ?? 0) + (resReviewByGp.get(gp.id) ?? 0)
      }
    }))
  };
}

function wardComparison(
  db: Database.Database,
  input: GeoDashboardQuery,
  wardIds: string[],
  ctx: string,
  title: string
): GeoDirectory {
  if (!wardIds.length) {
    return {
      key: "wards",
      title,
      searchPlaceholder: "Search ward",
      columns: [
        { key: "number", label: "No." },
        { key: "voters", label: "Selected-edition voters" },
        { key: "issues", label: "Unresolved issues" },
        { key: "overdue", label: "Overdue tasks" },
        { key: "review", label: "Needs review" }
      ],
      rows: []
    };
  }
  const wards = db
    .prepare(
      `SELECT id, name, name_te, ward_number FROM wards WHERE id IN (${inSql(wardIds)})
       ORDER BY CAST(ward_number AS INTEGER), name`
    )
    .all(...wardIds) as Array<{ id: string; name: string; name_te: string; ward_number: string }>;
  const voters = input.rollEditionId
    ? countsByWard(
        db,
        `SELECT assigned_ward_id AS id, COUNT(DISTINCT id) AS c FROM voter_entries
         WHERE constituency_id = ? AND roll_edition_id = ? AND archived = 0
           AND assigned_ward_id IN (${inSql(wardIds)}) GROUP BY assigned_ward_id`,
        [input.constituencyId, input.rollEditionId, ...wardIds]
      )
    : new Map<string, number>();
  const review = input.rollEditionId
    ? countsByWard(
        db,
        `SELECT assigned_ward_id AS id, COUNT(DISTINCT id) AS c FROM voter_entries
         WHERE constituency_id = ? AND roll_edition_id = ? AND archived = 0
           AND verification_status = 'needs_review' AND assigned_ward_id IN (${inSql(wardIds)})
         GROUP BY assigned_ward_id`,
        [input.constituencyId, input.rollEditionId, ...wardIds]
      )
    : new Map<string, number>();
  const issues = countsByWard(
    db,
    `SELECT ward_id AS id, COUNT(DISTINCT id) AS c FROM issues
     WHERE constituency_id = ? AND archived = 0 AND status IN ${OPEN_ISSUES}
       AND ward_id IN (${inSql(wardIds)}) GROUP BY ward_id`,
    [input.constituencyId, ...wardIds]
  );
  const overdue = countsByWard(
    db,
    `SELECT ward_id AS id, COUNT(DISTINCT id) AS c FROM tasks
     WHERE constituency_id = ? AND archived = 0 AND status IN ${OPEN_TASKS}
       AND due_date IS NOT NULL AND due_date < ? AND ward_id IN (${inSql(wardIds)})
     GROUP BY ward_id`,
    [input.constituencyId, localDateString(), ...wardIds]
  );
  return {
    key: "wards",
    title,
    searchPlaceholder: "Search ward",
    columns: [
      { key: "number", label: "No." },
      { key: "voters", label: "Selected-edition voters" },
      { key: "issues", label: "Unresolved issues" },
      { key: "overdue", label: "Overdue tasks" },
      { key: "review", label: "Needs review" }
    ],
    rows: wards.map((ward) => ({
      id: ward.id,
      name: ward.name,
      nameTe: ward.name_te,
      href: `/wards/${ward.id}${ctx}`,
      values: {
        number: ward.ward_number,
        voters: input.rollEditionId ? (voters.get(ward.id) ?? 0) : null,
        issues: issues.get(ward.id) ?? 0,
        overdue: overdue.get(ward.id) ?? 0,
        review: review.get(ward.id) ?? 0
      }
    }))
  };
}

function identity(
  db: Database.Database,
  input: GeoDashboardQuery,
  constituencyName: string
): {
  name: string;
  nameTe: string;
  classification: string;
  breadcrumb: Array<{ label: string; href: string }>;
  parentName: string | null;
  administrativeMandalName: string | null;
  villages: Array<{ id: string; name: string; nameTe: string }>;
} {
  const ctx = contextQuery(input);
  const home = `/${ctx || ""}`;
  if (input.level === "assembly") {
    return {
      name: constituencyName,
      nameTe: "",
      classification: "Assembly constituency",
      breadcrumb: [{ label: constituencyName, href: home }],
      parentName: null,
      administrativeMandalName: null,
      villages: []
    };
  }
  if (input.level === "mandal") {
    const row = named(db, "mandals", input.unitId!);
    if (!row) throw new AppError("not_found", "Mandal not found.");
    return {
      name: row.name,
      nameTe: row.name_te,
      classification: "Mandal",
      breadcrumb: [
        { label: constituencyName, href: home },
        { label: row.name, href: `/areas/mandals/${row.id}${ctx}` }
      ],
      parentName: constituencyName,
      administrativeMandalName: null,
      villages: []
    };
  }
  if (input.level === "gram_panchayat") {
    const row = db
      .prepare(
        `SELECT gp.id, gp.name, gp.name_te, m.id AS mandal_id, m.name AS mandal_name
         FROM gram_panchayats gp JOIN mandals m ON m.id = gp.mandal_id WHERE gp.id = ?`
      )
      .get(input.unitId) as
      | { id: string; name: string; name_te: string; mandal_id: string; mandal_name: string }
      | undefined;
    if (!row) throw new AppError("not_found", "Gram Panchayat not found.");
    return {
      name: row.name,
      nameTe: row.name_te,
      classification: "Gram Panchayat",
      breadcrumb: [
        { label: constituencyName, href: home },
        { label: row.mandal_name, href: `/areas/mandals/${row.mandal_id}${ctx}` },
        { label: row.name, href: `/areas/gps/${row.id}${ctx}` }
      ],
      parentName: row.mandal_name,
      administrativeMandalName: null,
      villages: []
    };
  }
  if (input.level === "urban_local_body") {
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.name_te, u.body_type, m.name AS mandal_name
         FROM urban_local_bodies u LEFT JOIN mandals m ON m.id = u.administrative_mandal_id
         WHERE u.id = ?`
      )
      .get(input.unitId) as
      | { id: string; name: string; name_te: string; body_type: string; mandal_name: string | null }
      | undefined;
    if (!row) throw new AppError("not_found", "Urban local body not found.");
    return {
      name: row.name,
      nameTe: row.name_te,
      classification: row.body_type.replaceAll("_", " "),
      breadcrumb: [
        { label: constituencyName, href: home },
        { label: row.name, href: `/areas/ulbs/${row.id}${ctx}` }
      ],
      parentName: constituencyName,
      administrativeMandalName: row.mandal_name,
      villages: []
    };
  }
  const ward = db
    .prepare(
      `SELECT w.id, w.name, w.name_te, w.ward_number, w.classification, w.gram_panchayat_id, w.urban_local_body_id,
              gp.name AS gp_name, m.id AS mandal_id, m.name AS mandal_name, u.name AS ulb_name, u.body_type
       FROM wards w
       LEFT JOIN gram_panchayats gp ON gp.id = w.gram_panchayat_id
       LEFT JOIN mandals m ON m.id = gp.mandal_id
       LEFT JOIN urban_local_bodies u ON u.id = w.urban_local_body_id
       WHERE w.id = ?`
    )
    .get(input.unitId) as
    | {
        id: string;
        name: string;
        name_te: string;
        ward_number: string;
        classification: string;
        gram_panchayat_id: string | null;
        urban_local_body_id: string | null;
        gp_name: string | null;
        mandal_id: string | null;
        mandal_name: string | null;
        ulb_name: string | null;
        body_type: string | null;
      }
    | undefined;
  if (!ward) throw new AppError("not_found", "Ward not found.");
  const crumbs = [{ label: constituencyName, href: home }];
  if (ward.classification === "rural") {
    if (ward.mandal_id && ward.mandal_name) crumbs.push({ label: ward.mandal_name, href: `/areas/mandals/${ward.mandal_id}${ctx}` });
    if (ward.gram_panchayat_id && ward.gp_name) {
      crumbs.push({ label: ward.gp_name, href: `/areas/gps/${ward.gram_panchayat_id}${ctx}` });
    }
  } else if (ward.urban_local_body_id && ward.ulb_name) {
    crumbs.push({ label: ward.ulb_name, href: `/areas/ulbs/${ward.urban_local_body_id}${ctx}` });
  }
  crumbs.push({ label: `Ward ${ward.ward_number}`, href: `/wards/${ward.id}${ctx}` });
  const villageRows = db
    .prepare(
      `SELECT v.id, v.name, v.name_te FROM village_ward_mappings m
       JOIN villages v ON v.id = m.village_id WHERE m.ward_id = ? ORDER BY v.name`
    )
    .all(ward.id) as Array<{ id: string; name: string; name_te: string }>;
  return {
    name: ward.name,
    nameTe: ward.name_te,
    classification: ward.classification === "rural" ? `Rural ward ${ward.ward_number}` : `Municipal ward ${ward.ward_number}`,
    breadcrumb: crumbs,
    parentName: ward.gp_name || ward.ulb_name,
    administrativeMandalName: null,
    villages: villageRows.map((row) => ({ id: row.id, name: row.name, nameTe: row.name_te }))
  };
}

function levelPath(input: GeoDashboardQuery): string {
  if (input.level === "assembly") return "/";
  if (input.level === "mandal") return `/areas/mandals/${input.unitId}`;
  if (input.level === "gram_panchayat") return `/areas/gps/${input.unitId}`;
  if (input.level === "urban_local_body") return `/areas/ulbs/${input.unitId}`;
  return `/wards/${input.unitId}`;
}

export function geoDashboard(db: Database.Database, input: GeoDashboardQuery): GeoDashboard {
  const constituency = db
    .prepare("SELECT id, name FROM assembly_constituencies WHERE id = ?")
    .get(input.constituencyId) as { id: string; name: string } | undefined;
  if (!constituency) throw new AppError("not_found", "Constituency not found.");
  const boundary = db
    .prepare("SELECT id, name FROM boundary_versions WHERE id = ?")
    .get(input.boundaryVersionId) as { id: string; name: string } | undefined;
  if (!boundary) throw new AppError("not_found", "Boundary version not found.");
  const scope = resolveScope(db, input.constituencyId, input.boundaryVersionId);
  const ids = scopedIds(db, scope, input);
  const ctx = contextQuery(input);
  const ident = identity(db, input, constituency.name);
  const voters = voterCounts(
    db,
    input.constituencyId,
    input.rollEditionId,
    ids.allWardIds,
    input.level === "assembly"
  );
  const edition = input.rollEditionId
    ? (db
        .prepare("SELECT name, revision_code, boundary_version_id FROM roll_editions WHERE id = ?")
        .get(input.rollEditionId) as
        | { name: string; revision_code: string; boundary_version_id: string }
        | undefined)
    : undefined;
  if (input.rollEditionId && !edition) throw new AppError("not_found", "Roll edition not found.");
  const election = input.electionId
    ? (db.prepare("SELECT name FROM elections WHERE id = ? AND constituency_id = ?").get(input.electionId, input.constituencyId) as
        | { name: string }
        | undefined)
    : undefined;
  if (input.electionId && !election) {
    throw new AppError("constituency_isolation", "Election workspace is outside the selected constituency.");
  }
  const voterHint = edition
    ? `Roll edition “${edition.name}”${edition.revision_code ? ` (${edition.revision_code})` : ""}. Distinct archived-excluded entries assigned to wards in this coverage. Not an official population total.`
    : "Select one roll edition. Totals are never combined across editions.";
  const voterHref = `/voters${qs({
    edition: input.rollEditionId,
    ward: input.level === "rural_ward" || input.level === "urban_ward" ? input.unitId : undefined
  })}`;
  const metrics: GeoMetric[] = [];
  if (input.level === "assembly") {
    metrics.push(
      metric("mandals", "Mandals", ids.mandalIds.length, `/${contextQuery(input, { section: "mandals" })}`, "Distinct mandals in constituency coverage, including ancestor mandals of mapped GPs."),
      metric("gps", "Gram Panchayats", ids.gpIds.length, `/${contextQuery(input, { section: "gps" })}`, "Distinct GPs in coverage. Partial mandal coverage does not include unmapped GPs."),
      metric("villages", "Villages", ids.villageIds.length, `/${contextQuery(input, { section: "gps" })}`, "Distinct villages in coverage, counted from village records rather than village–ward joins."),
      metric("ulbs", "Urban local bodies", ids.ulbIds.length, `/${contextQuery(input, { section: "ulbs" })}`, "Municipalities, municipal corporations and nagar panchayats in coverage. Urban navigation is not nested under mandals."),
      metric("ruralWards", "Rural wards", ids.ruralWardIds.length, "/wards", "Distinct rural wards on this boundary version that are in coverage."),
      metric("urbanWards", "Municipal wards", ids.urbanWardIds.length, `/${contextQuery(input, { section: "ulbs" })}`, "Distinct urban wards on this boundary version that are in coverage."),
      metric(
        "electionWorkspaces",
        "Election workspaces",
        countSql(db, "SELECT COUNT(*) AS c FROM elections WHERE constituency_id = ?", [input.constituencyId]),
        "/elections",
        "Election workspaces recorded for this constituency, including archived snapshots."
      )
    );
  } else if (input.level === "mandal") {
    metrics.push(
      metric("gps", "Gram Panchayats", ids.gpIds.length, `/areas/mandals/${input.unitId}${contextQuery(input, { section: "gps" })}`, "GPs of this mandal that are in constituency coverage."),
      metric("villages", "Villages", ids.villageIds.length, `/areas/mandals/${input.unitId}${contextQuery(input, { section: "villages" })}`, "Distinct villages of covered GPs."),
      metric("ruralWards", "Rural wards", ids.ruralWardIds.length, `/areas/mandals/${input.unitId}${contextQuery(input, { section: "wards" })}`, "Rural wards of covered GPs on this boundary version.")
    );
  } else if (input.level === "gram_panchayat") {
    metrics.push(
      metric("villages", "Linked villages", ids.villageIds.length, `/areas/gps/${input.unitId}${contextQuery(input, { section: "villages" })}`, "Villages of this Gram Panchayat that are in coverage."),
      metric("ruralWards", "Rural wards", ids.ruralWardIds.length, `/areas/gps/${input.unitId}${contextQuery(input, { section: "wards" })}`, "Rural wards of this GP on the selected boundary version.")
    );
  } else if (input.level === "urban_local_body") {
    metrics.push(
      metric("urbanWards", "Municipal wards", ids.urbanWardIds.length, `/areas/ulbs/${input.unitId}${contextQuery(input, { section: "wards" })}`, "Covered municipal wards of this local body on the selected boundary version.")
    );
  }

  metrics.push(
    metric(
      "voters",
      "Voter entries",
      voters.total,
      voterHref,
      voterHint,
      voters.missing
    )
  );
  if (input.level === "assembly") {
    metrics.push(
      metric(
        "unassignedVoters",
        "Unassigned voter entries",
        voters.unassigned,
        `/voters${qs({ edition: input.rollEditionId, assignment: "unassigned" })}`,
        edition
          ? `Unassigned entries in “${edition.name}” for this constituency (not attached to a ward).`
          : "Select a roll edition to count unassigned entries.",
        voters.missing
      )
    );
  }
  const unresolved = issueCount(db, input.constituencyId, ids.allWardIds);
  const overdue = overdueCount(db, input.constituencyId, ids.allWardIds);
  const openTasks = openTaskCount(db, input.constituencyId, ids.allWardIds);
  metrics.push(
    metric(
      "issues",
      "Unresolved issues",
      unresolved,
      input.level.endsWith("ward") ? `/wards/${input.unitId}/issues` : `${levelPath(input)}${contextQuery(input, { section: "issues" })}`,
      "Open or in-progress issues on wards in this geographic scope."
    ),
    metric(
      "openTasks",
      "Open tasks",
      openTasks,
      input.level.endsWith("ward") ? `/wards/${input.unitId}/tasks` : `${levelPath(input)}${contextQuery(input, { section: "tasks" })}`,
      "Open or in-progress tasks on wards in this geographic scope."
    ),
    metric(
      "overdue",
      "Overdue tasks",
      overdue,
      input.level.endsWith("ward") ? `/wards/${input.unitId}/tasks` : `${levelPath(input)}${contextQuery(input, { section: "tasks" })}`,
      "Open or in-progress tasks with a due date before today."
    )
  );
  const resReview = reservationReviewCount(
    db,
    input.constituencyId,
    ids.gpIds,
    ids.ruralWardIds,
    input.electionId,
    input.notificationId
  );
  if (input.level !== "urban_local_body" && input.level !== "urban_ward") {
    metrics.push(
      metric(
        "reservationReview",
        "Reservation records awaiting review",
        resReview,
        `/reservations${qs({ election: input.electionId, notification: input.notificationId })}`,
        "Seat reservations in this geography that are not mapped. Categories describe seats, not people."
      )
    );
  }
  if ((input.level === "rural_ward" || input.level === "urban_ward") && input.unitId) {
    const contacts = countSql(
      db,
      `SELECT COUNT(DISTINCT id) AS c FROM ward_contact_links
       WHERE ward_id = ? AND constituency_id = ? AND archived = 0`,
      [input.unitId, input.constituencyId]
    );
    const teamCount = countSql(
      db,
      `SELECT COUNT(DISTINCT id) AS c FROM team_assignments
       WHERE ward_id = ? AND constituency_id = ? AND status = 'active'`,
      [input.unitId, input.constituencyId]
    );
    metrics.push(
      metric("contacts", "Active contacts", contacts, `/wards/${input.unitId}/contacts`, "Active ward contact links in this constituency."),
      metric("team", "Active team assignments", teamCount, `/wards/${input.unitId}/team`, "Active team assignments for this ward.")
    );
  }

  const directories: GeoDirectory[] = [];
  if (input.level === "assembly") {
    const mandals = ids.mandalIds.length
      ? (db
          .prepare(`SELECT id, name, name_te FROM mandals WHERE id IN (${inSql(ids.mandalIds)}) ORDER BY name`)
          .all(...ids.mandalIds) as Array<{ id: string; name: string; name_te: string }>)
      : [];
    directories.push(
      directoryFromNamed(
        "mandals",
        "Rural areas — mandals",
        "Search mandal",
        mandals.map((row) => ({
          id: row.id,
          name: row.name,
          nameTe: row.name_te,
          href: `/areas/mandals/${row.id}${ctx}`
        }))
      )
    );
      directories.push(gpComparison(db, input, ids.gpIds, ids.ruralWardIds, ctx));
    const ulbs = ids.ulbIds.length
      ? (db
          .prepare(
            `SELECT id, name, name_te, body_type FROM urban_local_bodies WHERE id IN (${inSql(ids.ulbIds)}) ORDER BY name`
          )
          .all(...ids.ulbIds) as Array<{ id: string; name: string; name_te: string; body_type: string }>)
      : [];
    directories.push(
      directoryFromNamed(
        "ulbs",
        "Urban areas — local bodies",
        "Search municipality or urban local body",
        ulbs.map((row) => ({
          id: row.id,
          name: row.name,
          nameTe: row.name_te,
          href: `/areas/ulbs/${row.id}${ctx}`,
          subtitle: row.body_type.replaceAll("_", " ")
        }))
      )
    );
  }
  if (input.level === "mandal") {
      directories.push(gpComparison(db, input, ids.gpIds, ids.ruralWardIds, ctx));
    const villages = ids.villageIds.length
      ? (db
          .prepare(`SELECT id, name, name_te FROM villages WHERE id IN (${inSql(ids.villageIds)}) ORDER BY name`)
          .all(...ids.villageIds) as Array<{ id: string; name: string; name_te: string }>)
      : [];
    directories.push(
      directoryFromNamed(
        "villages",
        "Villages",
        "Search village",
        villages.map((row) => ({ id: row.id, name: row.name, nameTe: row.name_te, href: `#village-${row.id}` }))
      )
    );
    directories.push(wardComparison(db, input, ids.ruralWardIds, ctx, "Rural wards"));
  }
  if (input.level === "gram_panchayat") {
    const villages = ids.villageIds.length
      ? (db
          .prepare(`SELECT id, name, name_te FROM villages WHERE id IN (${inSql(ids.villageIds)}) ORDER BY name`)
          .all(...ids.villageIds) as Array<{ id: string; name: string; name_te: string }>)
      : [];
    directories.push(
      directoryFromNamed(
        "villages",
        "Villages",
        "Search village",
        villages.map((row) => ({ id: row.id, name: row.name, nameTe: row.name_te, href: `#village-${row.id}` }))
      )
    );
    directories.push(wardComparison(db, input, ids.ruralWardIds, ctx, "Rural wards"));
  }
  if (input.level === "urban_local_body") {
    directories.push(wardComparison(db, input, ids.urbanWardIds, ctx, "Municipal wards"));
  }

  const reviewItems: GeoReviewItem[] = [];
  if (voters.review) {
    reviewItems.push({
      key: "voter-review",
      label: "Voter entries needing review",
      count: voters.review,
      href: `/voters${qs({ edition: input.rollEditionId, verification: "needs_review" })}`
    });
  }
  if (input.level === "assembly" && voters.unassigned) {
    reviewItems.push({
      key: "unassigned",
      label: "Unassigned voter entries",
      count: voters.unassigned ?? 0,
      href: `/voters${qs({ edition: input.rollEditionId, assignment: "unassigned" })}`
    });
  }
  if (resReview && input.level !== "urban_local_body" && input.level !== "urban_ward") {
    reviewItems.push({
      key: "reservations",
      label: "Reservation records awaiting review",
      count: resReview,
      href: `/reservations${qs({ election: input.electionId, notification: input.notificationId })}`
    });
  }

  const shortcuts: Array<{ label: string; href: string }> = [
    { label: "Coverage", href: "/coverage" },
    { label: "Voters", href: `/voters${qs({ edition: input.rollEditionId })}` }
  ];
  if (input.level === "assembly") {
    shortcuts.push({ label: "Rural records", href: "/rural" }, { label: "Urban records", href: "/urban" }, { label: "Seat reservations", href: "/reservations" });
  }
  if (input.level.endsWith("ward") && input.unitId) {
    shortcuts.push(
      { label: "Contacts", href: `/wards/${input.unitId}/contacts` },
      { label: "Team", href: `/wards/${input.unitId}/team` },
      { label: "Issues", href: `/wards/${input.unitId}/issues` },
      { label: "Tasks", href: `/wards/${input.unitId}/tasks` },
      { label: "Voters", href: `/wards/${input.unitId}/voters` }
    );
  }

  const urbanOnly = input.level === "urban_local_body" || input.level === "urban_ward";
  const reservation = reservationSnapshot(
    db,
    input,
    input.level === "gram_panchayat" || input.level === "rural_ward" ? ids.gpIds : urbanOnly ? [] : ids.gpIds,
    urbanOnly ? ids.urbanWardIds : ids.ruralWardIds,
    urbanOnly
  );

  let team: GeoTeamMember[] = [];
  if (input.level.endsWith("ward") && input.unitId) {
    team = (
      db
        .prepare(
          `SELECT a.id, p.name, a.operational_role FROM team_assignments a
           JOIN persons p ON p.id = a.person_id
           WHERE a.ward_id = ? AND a.constituency_id = ? AND a.status = 'active'
           ORDER BY p.name`
        )
        .all(input.unitId, input.constituencyId) as Array<{ id: string; name: string; operational_role: string }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      role: row.operational_role.replaceAll("_", " "),
      href: `/wards/${input.unitId}/team`
    }));
  }

  const { overdueTasks, unresolvedIssues } = workLists(db, input.constituencyId, ids.allWardIds);
  return {
    level: input.level,
    unitId: input.unitId || input.constituencyId,
    name: ident.name,
    nameTe: ident.nameTe,
    classification: ident.classification,
    breadcrumb: ident.breadcrumb,
    boundaryName: boundary.name,
    electionName: election?.name ?? null,
    rollEditionName: edition?.name ?? null,
    rollEditionHint:
      edition && edition.boundary_version_id !== input.boundaryVersionId
        ? "This roll edition belongs to a different boundary version than the selected geography."
        : null,
    administrativeMandalName: ident.administrativeMandalName,
    parentName: ident.parentName,
    metrics,
    directories,
    overdueTasks,
    unresolvedIssues,
    recentActivity: recentActivity(db, input.constituencyId, ids.allWardIds),
    reviewItems,
    shortcuts,
    reservation,
    team,
    villages: ident.villages
  };
}

export type { GeoDashboardLevel };
