import type Database from "better-sqlite3";
import { localDateString } from "@shared/dates";
import type { ActivityItem, DashboardAttention, DashboardCounts, DashboardWorkItem } from "@shared/types";
import { resolveScope } from "./coverage";

export function dashboardCounts(
  db: Database.Database,
  constituencyId: string,
  boundaryVersionId: string
): DashboardCounts {
  const scope = resolveScope(db, constituencyId, boundaryVersionId);
  const elections = (
    db
      .prepare("SELECT COUNT(*) AS c FROM elections WHERE constituency_id = ?")
      .get(constituencyId) as { c: number }
  ).c;
  return {
    mandals: Object.keys(scope.mandals).length,
    gramPanchayats: Object.keys(scope.gramPanchayats).length,
    villages: Object.keys(scope.villages).length,
    urbanLocalBodies: Object.keys(scope.urbanLocalBodies).length,
    ruralWards: Object.keys(scope.ruralWards).length,
    urbanWards: Object.keys(scope.urbanWards).length,
    electionWorkspaces: elections
  };
}

function wardHref(kind: ActivityItem["kind"], wardId: string): string {
  if (kind === "task") return `/wards/${wardId}/tasks`;
  if (kind === "issue") return `/wards/${wardId}/issues`;
  if (kind === "team") return `/wards/${wardId}/team`;
  return `/wards/${wardId}/contacts`;
}

export function dashboardAttention(db: Database.Database, constituencyId: string): DashboardAttention {
  const today = localDateString();
  const overdueTasks = (
    db
      .prepare(
        `SELECT t.id, t.title, t.due_date, t.status, t.ward_id, w.name AS ward_name
         FROM tasks t JOIN wards w ON w.id = t.ward_id
         WHERE t.constituency_id = ? AND t.archived = 0 AND t.status IN ('open','in_progress')
           AND t.due_date IS NOT NULL AND t.due_date < ?
         ORDER BY t.due_date, t.updated_at DESC LIMIT 8`
      )
      .all(constituencyId, today) as Array<{
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
        `SELECT i.id, i.title, i.status, i.reference_number, i.ward_id, w.name AS ward_name
         FROM issues i JOIN wards w ON w.id = i.ward_id
         WHERE i.constituency_id = ? AND i.archived = 0 AND i.status IN ('open','in_progress')
         ORDER BY i.updated_at DESC LIMIT 8`
      )
      .all(constituencyId) as Array<{
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

  const recent: ActivityItem[] = [];
  const contacts = db
    .prepare(
      `SELECT c.id, c.updated_at, c.ward_id, w.name AS ward_name, p.name
       FROM ward_contact_links c
       JOIN wards w ON w.id = c.ward_id
       JOIN persons p ON p.id = c.person_id
       WHERE c.constituency_id = ? ORDER BY c.updated_at DESC LIMIT 5`
    )
    .all(constituencyId) as Array<{ id: string; updated_at: string; ward_id: string; ward_name: string; name: string }>;
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
      href: wardHref("contact", row.ward_id)
    });
  }
  const team = db
    .prepare(
      `SELECT a.id, a.updated_at, a.ward_id, w.name AS ward_name, p.name
       FROM team_assignments a
       JOIN wards w ON w.id = a.ward_id
       JOIN persons p ON p.id = a.person_id
       WHERE a.constituency_id = ? ORDER BY a.updated_at DESC LIMIT 5`
    )
    .all(constituencyId) as Array<{ id: string; updated_at: string; ward_id: string; ward_name: string; name: string }>;
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
      href: wardHref("team", row.ward_id)
    });
  }
  const issues = db
    .prepare(
      `SELECT i.id, i.updated_at, i.title, i.reference_number, i.ward_id, w.name AS ward_name
       FROM issues i JOIN wards w ON w.id = i.ward_id
       WHERE i.constituency_id = ? ORDER BY i.updated_at DESC LIMIT 5`
    )
    .all(constituencyId) as Array<{
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
      href: wardHref("issue", row.ward_id)
    });
  }
  const tasks = db
    .prepare(
      `SELECT t.id, t.updated_at, t.title, t.ward_id, w.name AS ward_name
       FROM tasks t JOIN wards w ON w.id = t.ward_id
       WHERE t.constituency_id = ? ORDER BY t.updated_at DESC LIMIT 5`
    )
    .all(constituencyId) as Array<{ id: string; updated_at: string; title: string; ward_id: string; ward_name: string }>;
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
      href: wardHref("task", row.ward_id)
    });
  }
  recent.sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    overdueTasks,
    unresolvedIssues,
    recentActivity: recent.slice(0, 8)
  };
}
