import type Database from "better-sqlite3";
import { AppError } from "../errors";
import { writeAudit } from "./audit";
import { setCoverage } from "./coverage";
import { createElection } from "./elections";
import { createBoundary, createConstituency, createGp, createMandal, createUlb, createVillage } from "./geo";
import { demoStatus } from "./settings";
import { createWard, setVillageWard } from "./wards";

export function loadDemoData(db: Database.Database): { loaded: boolean } {
  const status = demoStatus(db);
  if (!status.canLoadDemo) {
    throw new AppError(
      "demo_blocked",
      "Demonstration data is only loaded into an empty workspace. It will not be mixed with operational records."
    );
  }
  const tx = db.transaction(() => {
    const version = createBoundary(db, {
      name: "[DEMO] Boundary 2026",
      effectiveFrom: "2026-01-01",
      notes: "Fictional demonstration boundary. Not an official delimitation.",
      status: "active"
    });
    const constituency = createConstituency(
      db,
      {
        name: "[DEMO] Assembly Seat A",
        nameTe: "[DEMO] అసెంబ్లీ స్థానం ఎ",
        notes: "Fictional constituency for software demonstration."
      },
      true
    );
    const mandal = createMandal(
      db,
      { name: "[DEMO] Mandal One", nameTe: "[DEMO] మండలం వన్", notes: "Fictional mandal." },
      true
    );
    const unusedMandal = createMandal(
      db,
      { name: "[DEMO] Mandal Outside Coverage", nameTe: "[DEMO] కవరేజీ బయట మండలం" },
      true
    );
    const gp = createGp(
      db,
      { mandalId: mandal.id, name: "[DEMO] Gram Panchayat East", nameTe: "[DEMO] గ్రామ పంచాయతీ ఈస్ట్" },
      true
    );
    const otherGp = createGp(
      db,
      { mandalId: unusedMandal.id, name: "[DEMO] GP Not In Seat A", nameTe: "[DEMO] స్థానం ఎలో లేని జీపీ" },
      true
    );
    const villageA = createVillage(db, { gramPanchayatId: gp.id, name: "[DEMO] Village A", nameTe: "[DEMO] గ్రామం ఎ" }, true);
    const villageB = createVillage(db, { gramPanchayatId: gp.id, name: "[DEMO] Village B", nameTe: "[DEMO] గ్రామం బి" }, true);
    createVillage(db, { gramPanchayatId: otherGp.id, name: "[DEMO] Village Elsewhere", nameTe: "[DEMO] వేరే గ్రామం" }, true);
    const ulb = createUlb(
      db,
      {
        bodyType: "municipality",
        name: "[DEMO] Example Municipality",
        nameTe: "[DEMO] ఉదాహరణ మున్సిపాలిటీ",
        administrativeMandalId: mandal.id
      },
      true
    );
    const rural1 = createWard(
      db,
      {
        classification: "rural",
        gramPanchayatId: gp.id,
        boundaryVersionId: version.id,
        wardNumber: "1",
        name: "[DEMO] Rural Ward 1",
        nameTe: "[DEMO] గ్రామీణ వార్డు 1",
        recordSource: "Demonstration seed",
        lastVerifiedAt: "2026-01-15"
      },
      true
    );
    const rural2 = createWard(
      db,
      {
        classification: "rural",
        gramPanchayatId: gp.id,
        boundaryVersionId: version.id,
        wardNumber: "2",
        name: "[DEMO] Rural Ward 2",
        nameTe: "[DEMO] గ్రామీణ వార్డు 2",
        recordSource: "Demonstration seed"
      },
      true
    );
    const urban1 = createWard(
      db,
      {
        classification: "urban",
        urbanLocalBodyId: ulb.id,
        boundaryVersionId: version.id,
        wardNumber: "1",
        name: "[DEMO] Urban Ward 1",
        nameTe: "[DEMO] పట్టణ వార్డు 1",
        recordSource: "Demonstration seed"
      },
      true
    );
    setVillageWard(db, { villageId: villageA.id, wardId: rural1.id, coverageKind: "complete", notes: "Demo complete village coverage." });
    setVillageWard(db, { villageId: villageB.id, wardId: rural1.id, coverageKind: "partial", notes: "Demo partial village coverage — not treated as complete." });
    setVillageWard(db, { villageId: villageB.id, wardId: rural2.id, coverageKind: "partial" });
    setCoverage(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      unitType: "mandal",
      unitId: mandal.id,
      coverageKind: "partial",
      notes: "Partial mandal coverage. Descendants are not implied."
    });
    setCoverage(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      unitType: "gram_panchayat",
      unitId: gp.id,
      coverageKind: "complete"
    });
    setCoverage(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      unitType: "urban_local_body",
      unitId: ulb.id,
      coverageKind: "partial",
      notes: "Only explicitly mapped urban wards belong to this constituency."
    });
    setCoverage(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      unitType: "urban_ward",
      unitId: urban1.id,
      coverageKind: "complete"
    });
    createElection(
      db,
      {
        name: "[DEMO] Assembly 2026 workspace",
        electionType: "assembly",
        year: 2026,
        constituencyId: constituency.id,
        boundaryVersionId: version.id,
        status: "draft",
        notes: "Demonstration election workspace. Not an official notification.",
        wardIds: [rural1.id, rural2.id, urban1.id],
        coverage: [
          { unitType: "gram_panchayat", unitId: gp.id, coverageKind: "complete" },
          { unitType: "urban_ward", unitId: urban1.id, coverageKind: "complete" }
        ]
      },
      true
    );
    db.prepare("UPDATE app_meta SET value = ? WHERE key = 'data_kind'").run("demo");
    db.prepare("UPDATE app_meta SET value = ? WHERE key = 'default_constituency_id'").run(constituency.id);
    writeAudit(db, { action: "create", entityType: "demo_dataset", recordId: "demo", changedFields: [] });
  });
  tx();
  return { loaded: true };
}
