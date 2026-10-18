import type Database from "better-sqlite3";
import type { AppSettings, DataKind, Locale } from "@shared/types";
import { writeAudit } from "./audit";

function getMeta(db: Database.Database, key: string): string {
  return (db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? "";
}

export function getSettings(db: Database.Database): AppSettings {
  const defaultConstituencyId = getMeta(db, "default_constituency_id");
  return {
    organizationName: getMeta(db, "organization_name"),
    defaultConstituencyId: defaultConstituencyId.length ? defaultConstituencyId : null,
    locale: (getMeta(db, "locale") as Locale) || "en",
    dataKind: (getMeta(db, "data_kind") as DataKind) || "empty"
  };
}

export function updateSettings(db: Database.Database, input: Partial<AppSettings>): AppSettings {
  const current = getSettings(db);
  const next: AppSettings = {
    organizationName: input.organizationName ?? current.organizationName,
    defaultConstituencyId:
      input.defaultConstituencyId === undefined ? current.defaultConstituencyId : input.defaultConstituencyId,
    locale: input.locale ?? current.locale,
    dataKind: current.dataKind
  };
  db.prepare("UPDATE app_meta SET value = ? WHERE key = 'organization_name'").run(next.organizationName);
  db.prepare("UPDATE app_meta SET value = ? WHERE key = 'default_constituency_id'").run(next.defaultConstituencyId ?? "");
  db.prepare("UPDATE app_meta SET value = ? WHERE key = 'locale'").run(next.locale);
  writeAudit(db, {
    action: "update",
    entityType: "settings",
    recordId: "app_meta",
    changedFields: Object.keys(input)
  });
  return getSettings(db);
}

export function demoStatus(db: Database.Database): { dataKind: DataKind; canLoadDemo: boolean } {
  const dataKind = getSettings(db).dataKind;
  return { dataKind, canLoadDemo: dataKind === "empty" };
}
