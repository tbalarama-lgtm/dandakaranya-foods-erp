import type Database from "better-sqlite3";
import { PAGE_SIZE } from "@shared/constants";
import type { AuditRecord, PagedResult } from "@shared/types";
import { newId, nowIso } from "../db/ids";
import { mapAudit } from "../db/mappers";

export function writeAudit(
  db: Database.Database,
  input: {
    action: string;
    entityType: string;
    recordId: string;
    changedFields?: string[];
  }
): void {
  db.prepare(
    `INSERT INTO audit_log (id, created_at, action, entity_type, record_id, changed_fields)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    nowIso(),
    input.action,
    input.entityType,
    input.recordId,
    JSON.stringify(input.changedFields ?? [])
  );
}

export function listAudit(
  db: Database.Database,
  page = 1,
  pageSize = PAGE_SIZE
): PagedResult<AuditRecord> {
  const total = (db.prepare("SELECT COUNT(*) AS c FROM audit_log").get() as { c: number }).c;
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(pageSize, offset) as Record<string, unknown>[];
  return {
    items: rows.map(mapAudit),
    total,
    page,
    pageSize
  };
}
