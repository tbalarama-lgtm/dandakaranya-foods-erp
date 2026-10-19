import { describe, expect, it } from "vitest";
import { openMemory } from "../src/main/db/connection";
import { setCoverage } from "../src/main/services/coverage";
import { dashboardCounts } from "../src/main/services/dashboard";
import { geoDashboard } from "../src/main/services/geo-dashboard";
import { createElection } from "../src/main/services/elections";
import {
  archiveGp,
  createBoundary,
  createConstituency,
  createGp,
  createMandal,
  createUlb,
  createVillage
} from "../src/main/services/geo";
import { createWard, setVillageWard } from "../src/main/services/wards";
import { createEdition, createVoter } from "../src/main/services/voters";
import { createIssue, createTask } from "../src/main/services/workspace";
import { AppError } from "../src/main/errors";

function seed() {
  const db = openMemory();
  const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
  const otherVersion = createBoundary(db, { name: "v2", effectiveFrom: "2026-06-01", status: "draft" });
  const constituency = createConstituency(db, { name: "Seat A" });
  const other = createConstituency(db, { name: "Seat B" });
  const mandal = createMandal(db, { name: "Mandal One" });
  const gp = createGp(db, { mandalId: mandal.id, name: "GP East" });
  const village = createVillage(db, { gramPanchayatId: gp.id, name: "Village A" });
  const ulb = createUlb(db, { bodyType: "municipality", name: "Town", administrativeMandalId: mandal.id });
  const rural = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Rural 1"
  });
  const rural2 = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "2",
    name: "Rural 2"
  });
  const urban = createWard(db, {
    classification: "urban",
    urbanLocalBodyId: ulb.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Urban 1"
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
    coverageKind: "complete"
  });
  return { db, version, otherVersion, constituency, other, mandal, gp, village, ulb, rural, rural2, urban };
}

function metric(dash: ReturnType<typeof geoDashboard>, key: string): number | null {
  return dash.metrics.find((item) => item.key === key)?.value ?? null;
}

describe("Geographic dashboards", () => {
  it("counts distinct covered units at every level without leaking constituencies", () => {
    const geo = seed();
    const assembly = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "assembly"
    });
    const baseline = dashboardCounts(geo.db, geo.constituency.id, geo.version.id);
    expect(metric(assembly, "mandals")).toBe(baseline.mandals);
    expect(metric(assembly, "gps")).toBe(baseline.gramPanchayats);
    expect(metric(assembly, "villages")).toBe(baseline.villages);
    expect(metric(assembly, "ulbs")).toBe(baseline.urbanLocalBodies);
    expect(metric(assembly, "ruralWards")).toBe(baseline.ruralWards);
    expect(metric(assembly, "urbanWards")).toBe(baseline.urbanWards);
    const other = geoDashboard(geo.db, {
      constituencyId: geo.other.id,
      boundaryVersionId: geo.version.id,
      level: "assembly"
    });
    expect(metric(other, "ruralWards")).toBe(0);
    expect(metric(other, "gps")).toBe(0);
    expect(() =>
      geoDashboard(geo.db, {
        constituencyId: geo.other.id,
        boundaryVersionId: geo.version.id,
        level: "mandal",
        unitId: geo.mandal.id
      })
    ).toThrow(AppError);
  });

  it("does not expand partial coverage into descendant GPs or wards", () => {
    const db = openMemory();
    const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
    const constituency = createConstituency(db, { name: "Seat A" });
    const mandal = createMandal(db, { name: "Mandal One" });
    const gp = createGp(db, { mandalId: mandal.id, name: "GP East" });
    createWard(db, {
      classification: "rural",
      gramPanchayatId: gp.id,
      boundaryVersionId: version.id,
      wardNumber: "1",
      name: "Rural 1"
    });
    setCoverage(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      unitType: "mandal",
      unitId: mandal.id,
      coverageKind: "partial"
    });
    const dash = geoDashboard(db, {
      constituencyId: constituency.id,
      boundaryVersionId: version.id,
      level: "mandal",
      unitId: mandal.id
    });
    expect(metric(dash, "gps")).toBe(0);
    expect(metric(dash, "ruralWards")).toBe(0);
  });

  it("counts a village once even when mapped to two wards", () => {
    const geo = seed();
    setVillageWard(geo.db, { villageId: geo.village.id, wardId: geo.rural.id, coverageKind: "partial" });
    setVillageWard(geo.db, { villageId: geo.village.id, wardId: geo.rural2.id, coverageKind: "partial" });
    const assembly = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "assembly"
    });
    expect(metric(assembly, "villages")).toBe(1);
    const gpDash = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "gram_panchayat",
      unitId: geo.gp.id
    });
    expect(metric(gpDash, "villages")).toBe(1);
  });

  it("filters voters by one selected roll edition and treats missing selection as missing, not zero", () => {
    const geo = seed();
    const e1 = createEdition(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "Final 2024"
    });
    const e2 = createEdition(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "Draft 2025"
    });
    createVoter(geo.db, {
      rollEditionId: e1.id,
      constituencyId: geo.constituency.id,
      sourceName: "One",
      assignedWardId: geo.rural.id
    });
    createVoter(geo.db, {
      rollEditionId: e1.id,
      constituencyId: geo.constituency.id,
      sourceName: "Unassigned"
    });
    createVoter(geo.db, {
      rollEditionId: e2.id,
      constituencyId: geo.constituency.id,
      sourceName: "Two",
      assignedWardId: geo.rural.id
    });
    const noEdition = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "assembly"
    });
    expect(noEdition.metrics.find((item) => item.key === "voters")?.missing).toBe(true);
    expect(metric(noEdition, "voters")).toBeNull();
    const first = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "assembly",
      rollEditionId: e1.id
    });
    expect(metric(first, "voters")).toBe(1);
    expect(metric(first, "unassignedVoters")).toBe(1);
    const second = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "assembly",
      rollEditionId: e2.id
    });
    expect(metric(second, "voters")).toBe(1);
    expect(metric(second, "unassignedVoters")).toBe(0);
    const emptyWard = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "rural_ward",
      unitId: geo.rural2.id,
      rollEditionId: e1.id
    });
    expect(emptyWard.metrics.find((item) => item.key === "voters")?.missing).toBe(false);
    expect(metric(emptyWard, "voters")).toBe(0);
  });

  it("keeps archived records out of active counts and isolates boundaries", () => {
    const geo = seed();
    const edition = createEdition(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      name: "Final"
    });
    const live = createVoter(geo.db, {
      rollEditionId: edition.id,
      constituencyId: geo.constituency.id,
      sourceName: "Live",
      assignedWardId: geo.rural.id
    });
    createVoter(geo.db, {
      rollEditionId: edition.id,
      constituencyId: geo.constituency.id,
      sourceName: "Old",
      assignedWardId: geo.rural.id
    });
    geo.db.prepare("UPDATE voter_entries SET archived = 1 WHERE source_name = 'Old'").run();
    const dash = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "gram_panchayat",
      unitId: geo.gp.id,
      rollEditionId: edition.id
    });
    expect(metric(dash, "voters")).toBe(1);
    expect(live.archived).toBe(false);
    archiveGp(geo.db, geo.gp.id);
    const afterArchive = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "assembly"
    });
    expect(metric(afterArchive, "gps")).toBe(0);
    expect(() =>
      geoDashboard(geo.db, {
        constituencyId: geo.constituency.id,
        boundaryVersionId: geo.otherVersion.id,
        level: "rural_ward",
        unitId: geo.rural.id
      })
    ).toThrow(/not in the selected constituency coverage/);
  });

  it("scopes issues and overdue tasks to covered wards only", () => {
    const geo = seed();
    createIssue(geo.db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Open well",
      category: "water",
      reportedAt: "2026-01-01",
      priority: "high"
    });
    createTask(geo.db, {
      wardId: geo.urban.id,
      constituencyId: geo.constituency.id,
      title: "Late notice",
      dueDate: "2020-01-01"
    });
    const ruralGp = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "gram_panchayat",
      unitId: geo.gp.id
    });
    expect(metric(ruralGp, "issues")).toBe(1);
    expect(metric(ruralGp, "overdue")).toBe(0);
    const town = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "urban_local_body",
      unitId: geo.ulb.id
    });
    expect(metric(town, "issues")).toBe(0);
    expect(metric(town, "overdue")).toBe(1);
    expect(town.reservation?.applicable).toBe(false);
    expect(town.administrativeMandalName).toBe("Mandal One");
  });

  it("builds GP comparison rows and preserves election context links", () => {
    const geo = seed();
    const election = createElection(geo.db, {
      name: "GP 2026",
      electionType: "gram_panchayat",
      year: 2026,
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      status: "active",
      wardIds: [geo.rural.id],
      coverage: []
    });
    const dash = geoDashboard(geo.db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      level: "mandal",
      unitId: geo.mandal.id,
      electionId: election.id
    });
    const table = dash.directories.find((item) => item.key === "gps");
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]?.values.wards).toBe(2);
    expect(table?.rows[0]?.href).toContain("election=");
    expect(dash.breadcrumb.some((crumb) => crumb.href.startsWith("/areas/mandals/"))).toBe(true);
  });
});
