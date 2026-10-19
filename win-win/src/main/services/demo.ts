import type Database from "better-sqlite3";
import { AppError } from "../errors";
import { writeAudit } from "./audit";
import { setCoverage } from "./coverage";
import { createElection } from "./elections";
import { createBoundary, createConstituency, createGp, createMandal, createUlb, createVillage } from "./geo";
import { demoStatus } from "./settings";
import { createEdition, createVoter } from "./voters";
import { createWard, setVillageWard } from "./wards";
import { createAssignment, createContact, createIssue, createTask } from "./workspace";

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
    const lakshmi = createContact(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      organization: "[DEMO] Ward Coordination Desk",
      publicRole: "[DEMO] Ward coordinator",
      areaServed: "[DEMO] Rural Ward 1 streets",
      recordSource: "[DEMO] fictional seed",
      person: {
        name: "[DEMO] Lakshmi Reddy",
        nameTe: "[DEMO] లక్ష్మి రెడ్డి",
        consentStatus: "given",
        consentDate: "2026-01-10",
        consentSource: "[DEMO] scripted briefing note — not a real consent record"
      }
    });
    const kamala = createContact(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      organization: "[DEMO] Example Self-Help Group",
      publicRole: "[DEMO] Volunteer",
      recordSource: "[DEMO] fictional seed",
      person: {
        name: "[DEMO] Kamala Rao",
        nameTe: "[DEMO] కమల రావు",
        consentStatus: "not_given"
      }
    });
    createAssignment(db, {
      personId: lakshmi.personId,
      wardId: rural1.id,
      constituencyId: constituency.id,
      operationalRole: "ward_coordinator",
      responsibilities: "[DEMO] Coordinate ward follow-up. Fictional.",
      startDate: "2026-01-15",
      status: "active"
    });
    createAssignment(db, {
      personId: kamala.personId,
      wardId: rural1.id,
      constituencyId: constituency.id,
      operationalRole: "field_volunteer",
      responsibilities: "[DEMO] Ended field assignment. Fictional.",
      startDate: "2025-06-01",
      endDate: "2026-03-01",
      status: "inactive"
    });
    createIssue(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      title: "[DEMO] Handpump delay",
      category: "water",
      location: "[DEMO] Village A borewell",
      description: "Fictional open issue for software demonstration.",
      reportedAt: "2026-04-02",
      responsiblePersonId: lakshmi.personId,
      priority: "high",
      status: "open"
    });
    createIssue(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      title: "[DEMO] Street light restored",
      category: "electricity",
      location: "[DEMO] GP East road",
      description: "Fictional resolved issue for software demonstration.",
      reportedAt: "2026-02-10",
      responsiblePersonId: lakshmi.personId,
      priority: "medium",
      status: "resolved",
      resolutionNotes: "[DEMO] Light replaced. Fictional resolution notes."
    });
    createTask(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      title: "[DEMO] Upcoming ward notice round",
      assignedPersonId: lakshmi.personId,
      dueDate: "2026-10-22",
      status: "open",
      description: "Fictional upcoming task."
    });
    createTask(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      title: "[DEMO] Overdue water follow-up",
      assignedPersonId: lakshmi.personId,
      dueDate: "2026-01-20",
      status: "open",
      description: "Fictional overdue task."
    });
    createTask(db, {
      wardId: rural1.id,
      constituencyId: constituency.id,
      title: "[DEMO] Completed notice distribution",
      assignedPersonId: lakshmi.personId,
      dueDate: "2026-02-01",
      status: "done",
      completedAt: "2026-02-02",
      completionNotes: "[DEMO] Finished. Fictional."
    });
    const edition = createEdition(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      name: "[DEMO] Roll 2026",
      revisionCode: "r1",
      notes: "Fictional electoral-roll edition."
    });
    createVoter(db, {
      rollEditionId: edition.id,
      constituencyId: constituency.id,
      sourceName: "[DEMO] రాము",
      sourceNameEn: "[DEMO] Ramu",
      sourceElectoralId: "ABC0001",
      sourceRollSerial: "0012",
      sourceAddress: "[DEMO] Ward 1 house",
      assignedWardId: rural1.id
    });
    createVoter(db, {
      rollEditionId: edition.id,
      constituencyId: constituency.id,
      sourceName: "[DEMO] సీత",
      sourceNameEn: "[DEMO] Sita",
      sourceElectoralId: "ABC0002",
      sourceRollSerial: "0013",
      sourceAddress: "[DEMO] Address not mapped"
    });
    db.prepare("UPDATE app_meta SET value = ? WHERE key = 'data_kind'").run("demo");
    db.prepare("UPDATE app_meta SET value = ? WHERE key = 'default_constituency_id'").run(constituency.id);
    writeAudit(db, { action: "create", entityType: "demo_dataset", recordId: "demo", changedFields: [] });
  });
  tx();
  return { loaded: true };
}
