import type Database from "better-sqlite3";
import type { CoverageKind, ResolvedScope, UnitType } from "@shared/types";
import { AppError } from "../errors";
import { newId } from "../db/ids";
import { mapCoverage } from "../db/mappers";
import { writeAudit } from "./audit";

type Kind = CoverageKind | "inherited-complete" | "ancestor";

function setKind(target: Record<string, Kind>, id: string, kind: Kind): void {
  const existing = target[id];
  if (!existing) {
    target[id] = kind;
    return;
  }
  if (kind === "partial") {
    target[id] = "partial";
    return;
  }
  if (kind === "complete" && existing !== "partial") {
    target[id] = "complete";
  }
}

export function unitExists(db: Database.Database, unitType: UnitType, unitId: string): boolean {
  const table: Record<UnitType, string> = {
    mandal: "mandals",
    gram_panchayat: "gram_panchayats",
    village: "villages",
    urban_local_body: "urban_local_bodies",
    rural_ward: "wards",
    urban_ward: "wards"
  };
  const extraSelect = unitType === "rural_ward" || unitType === "urban_ward" ? "classification AS extra" : "id AS extra";
  const row = db.prepare(`SELECT id, ${extraSelect} FROM ${table[unitType]} WHERE id = ?`).get(unitId) as
    | { id: string; extra: string }
    | undefined;
  if (!row) return false;
  if (unitType === "rural_ward") return row.extra === "rural";
  if (unitType === "urban_ward") return row.extra === "urban";
  return true;
}

export function setCoverage(
  db: Database.Database,
  input: {
    constituencyId: string;
    boundaryVersionId: string;
    unitType: UnitType;
    unitId: string;
    coverageKind: CoverageKind;
    notes?: string;
  }
) {
  if (!unitExists(db, input.unitType, input.unitId)) {
    throw new AppError("invalid_coverage_unit", "Coverage must reference an existing geographic unit.");
  }
  const existing = db
    .prepare(
      `SELECT id FROM constituency_coverage
       WHERE constituency_id = ? AND boundary_version_id = ? AND unit_type = ? AND unit_id = ?`
    )
    .get(input.constituencyId, input.boundaryVersionId, input.unitType, input.unitId) as { id: string } | undefined;
  const id = existing?.id ?? newId();
  if (existing) {
    db.prepare(`UPDATE constituency_coverage SET coverage_kind = ?, notes = ? WHERE id = ?`).run(
      input.coverageKind,
      input.notes ?? "",
      id
    );
  } else {
    db.prepare(
      `INSERT INTO constituency_coverage
        (id, constituency_id, boundary_version_id, unit_type, unit_id, coverage_kind, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.constituencyId,
      input.boundaryVersionId,
      input.unitType,
      input.unitId,
      input.coverageKind,
      input.notes ?? ""
    );
  }
  writeAudit(db, {
    action: existing ? "update" : "create",
    entityType: "constituency_coverage",
    recordId: id,
    changedFields: ["coverageKind", "unitType", "unitId"]
  });
  return mapCoverage(
    db.prepare("SELECT * FROM constituency_coverage WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function deleteCoverage(db: Database.Database, id: string): void {
  const info = db.prepare("DELETE FROM constituency_coverage WHERE id = ?").run(id);
  if (info.changes === 0) throw new AppError("not_found", "Coverage mapping not found.");
  writeAudit(db, { action: "delete", entityType: "constituency_coverage", recordId: id, changedFields: [] });
}

export function listCoverage(
  db: Database.Database,
  constituencyId: string,
  boundaryVersionId: string
) {
  return (
    db
      .prepare(
        `SELECT * FROM constituency_coverage WHERE constituency_id = ? AND boundary_version_id = ? ORDER BY unit_type, unit_id`
      )
      .all(constituencyId, boundaryVersionId) as Record<string, unknown>[]
  ).map(mapCoverage);
}

export function resolveScope(
  db: Database.Database,
  constituencyId: string,
  boundaryVersionId: string
): ResolvedScope {
  const scope: ResolvedScope = {
    mandals: {},
    gramPanchayats: {},
    villages: {},
    urbanLocalBodies: {},
    ruralWards: {},
    urbanWards: {}
  };
  const mappings = listCoverage(db, constituencyId, boundaryVersionId);

  const expandMandal = (mandalId: string, inherited: boolean) => {
    const gps = db.prepare("SELECT id FROM gram_panchayats WHERE mandal_id = ?").all(mandalId) as Array<{ id: string }>;
    for (const gp of gps) expandGp(gp.id, inherited);
  };
  const expandGp = (gpId: string, inherited: boolean) => {
    setKind(scope.gramPanchayats, gpId, inherited ? "inherited-complete" : "complete");
    const villages = db.prepare("SELECT id FROM villages WHERE gram_panchayat_id = ?").all(gpId) as Array<{ id: string }>;
    for (const v of villages) setKind(scope.villages, v.id, "inherited-complete");
    const wards = db
      .prepare(
        "SELECT id FROM wards WHERE gram_panchayat_id = ? AND boundary_version_id = ? AND classification = 'rural'"
      )
      .all(gpId, boundaryVersionId) as Array<{ id: string }>;
    for (const w of wards) setKind(scope.ruralWards, w.id, "inherited-complete");
  };
  const expandUlb = (ulbId: string, inherited: boolean) => {
    setKind(scope.urbanLocalBodies, ulbId, inherited ? "inherited-complete" : "complete");
    const wards = db
      .prepare(
        "SELECT id FROM wards WHERE urban_local_body_id = ? AND boundary_version_id = ? AND classification = 'urban'"
      )
      .all(ulbId, boundaryVersionId) as Array<{ id: string }>;
    for (const w of wards) setKind(scope.urbanWards, w.id, "inherited-complete");
  };

  for (const mapping of mappings) {
    if (mapping.coverageKind !== "complete") continue;
    if (mapping.unitType === "mandal") {
      setKind(scope.mandals, mapping.unitId, "complete");
      expandMandal(mapping.unitId, true);
    } else if (mapping.unitType === "gram_panchayat") {
      expandGp(mapping.unitId, false);
      const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(mapping.unitId) as
        | { mandal_id: string }
        | undefined;
      if (gp) setKind(scope.mandals, gp.mandal_id, "ancestor");
    } else if (mapping.unitType === "village") {
      setKind(scope.villages, mapping.unitId, "complete");
      const village = db.prepare("SELECT gram_panchayat_id FROM villages WHERE id = ?").get(mapping.unitId) as
        | { gram_panchayat_id: string }
        | undefined;
      if (village) {
        setKind(scope.gramPanchayats, village.gram_panchayat_id, "ancestor");
        const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(village.gram_panchayat_id) as
          | { mandal_id: string }
          | undefined;
        if (gp) setKind(scope.mandals, gp.mandal_id, "ancestor");
      }
    } else if (mapping.unitType === "urban_local_body") {
      expandUlb(mapping.unitId, false);
    } else if (mapping.unitType === "rural_ward") {
      setKind(scope.ruralWards, mapping.unitId, "complete");
      const ward = db.prepare("SELECT gram_panchayat_id FROM wards WHERE id = ?").get(mapping.unitId) as
        | { gram_panchayat_id: string | null }
        | undefined;
      if (ward?.gram_panchayat_id) {
        setKind(scope.gramPanchayats, ward.gram_panchayat_id, "ancestor");
        const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(ward.gram_panchayat_id) as
          | { mandal_id: string }
          | undefined;
        if (gp) setKind(scope.mandals, gp.mandal_id, "ancestor");
      }
    } else if (mapping.unitType === "urban_ward") {
      setKind(scope.urbanWards, mapping.unitId, "complete");
      const ward = db.prepare("SELECT urban_local_body_id FROM wards WHERE id = ?").get(mapping.unitId) as
        | { urban_local_body_id: string | null }
        | undefined;
      if (ward?.urban_local_body_id) setKind(scope.urbanLocalBodies, ward.urban_local_body_id, "ancestor");
    }
  }

  for (const mapping of mappings) {
    if (mapping.coverageKind !== "partial") continue;
    if (mapping.unitType === "mandal") {
      setKind(scope.mandals, mapping.unitId, "partial");
    } else if (mapping.unitType === "gram_panchayat") {
      setKind(scope.gramPanchayats, mapping.unitId, "partial");
      const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(mapping.unitId) as
        | { mandal_id: string }
        | undefined;
      if (gp) setKind(scope.mandals, gp.mandal_id, "ancestor");
    } else if (mapping.unitType === "village") {
      setKind(scope.villages, mapping.unitId, "partial");
      const village = db.prepare("SELECT gram_panchayat_id FROM villages WHERE id = ?").get(mapping.unitId) as
        | { gram_panchayat_id: string }
        | undefined;
      if (village) {
        setKind(scope.gramPanchayats, village.gram_panchayat_id, "ancestor");
        const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(village.gram_panchayat_id) as
          | { mandal_id: string }
          | undefined;
        if (gp) setKind(scope.mandals, gp.mandal_id, "ancestor");
      }
    } else if (mapping.unitType === "urban_local_body") {
      setKind(scope.urbanLocalBodies, mapping.unitId, "partial");
    } else if (mapping.unitType === "rural_ward") {
      setKind(scope.ruralWards, mapping.unitId, "partial");
      const ward = db.prepare("SELECT gram_panchayat_id FROM wards WHERE id = ?").get(mapping.unitId) as
        | { gram_panchayat_id: string | null }
        | undefined;
      if (ward?.gram_panchayat_id) {
        setKind(scope.gramPanchayats, ward.gram_panchayat_id, "ancestor");
        const gp = db.prepare("SELECT mandal_id FROM gram_panchayats WHERE id = ?").get(ward.gram_panchayat_id) as
          | { mandal_id: string }
          | undefined;
        if (gp) setKind(scope.mandals, gp.mandal_id, "ancestor");
      }
    } else if (mapping.unitType === "urban_ward") {
      setKind(scope.urbanWards, mapping.unitId, "partial");
      const ward = db.prepare("SELECT urban_local_body_id FROM wards WHERE id = ?").get(mapping.unitId) as
        | { urban_local_body_id: string | null }
        | undefined;
      if (ward?.urban_local_body_id) setKind(scope.urbanLocalBodies, ward.urban_local_body_id, "ancestor");
    }
  }

  return scope;
}

export function wardInScope(scope: ResolvedScope, wardId: string, classification: "rural" | "urban"): boolean {
  const map = classification === "rural" ? scope.ruralWards : scope.urbanWards;
  return Boolean(map[wardId]);
}
