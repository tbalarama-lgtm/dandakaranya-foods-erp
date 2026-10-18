import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseManager, openMemory } from "../src/main/db/connection";
import { resolveDataPaths } from "../src/main/db/paths";
import { createBackup, restoreBackup } from "../src/main/services/backup";
import { listCoverage, resolveScope, setCoverage } from "../src/main/services/coverage";
import { dashboardCounts } from "../src/main/services/dashboard";
import { archiveElection, createElection, getElection } from "../src/main/services/elections";
import {
  createBoundary,
  createConstituency,
  createGp,
  createMandal,
  createUlb,
  createVillage,
  listMandals
} from "../src/main/services/geo";
import { createWard, listWards, setVillageWard } from "../src/main/services/wards";
import { AppError } from "../src/main/errors";

function seedGeo(db: ReturnType<typeof openMemory>) {
  const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
  const constituency = createConstituency(db, { name: "Seat A", nameTe: "సీట్ ఎ" });
  const other = createConstituency(db, { name: "Seat B" });
  const mandal = createMandal(db, { name: "Mandal One", nameTe: "మండలం" });
  const otherMandal = createMandal(db, { name: "Outside" });
  const gp = createGp(db, { mandalId: mandal.id, name: "GP East", nameTe: "జీపీ" });
  const otherGp = createGp(db, { mandalId: otherMandal.id, name: "Other GP" });
  const village = createVillage(db, { gramPanchayatId: gp.id, name: "Village A", nameTe: "గ్రామం ఎ" });
  createVillage(db, { gramPanchayatId: otherGp.id, name: "Elsewhere" });
  const ulb = createUlb(db, { bodyType: "municipality", name: "Town" });
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
  return { version, constituency, other, mandal, otherMandal, gp, otherGp, village, ulb, rural, rural2, urban };
}

describe("Phase 1 geography and elections", () => {
  it("rejects invalid rural/urban parents and duplicate ward numbers in the same parent+version", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    expect(() =>
      createWard(db, {
        classification: "rural",
        urbanLocalBodyId: geo.ulb.id,
        boundaryVersionId: geo.version.id,
        wardNumber: "9",
        name: "bad"
      })
    ).toThrow(/Gram Panchayat/);
    expect(() =>
      createWard(db, {
        classification: "rural",
        gramPanchayatId: geo.gp.id,
        boundaryVersionId: geo.version.id,
        wardNumber: "1",
        name: "dup"
      })
    ).toThrow(/unique/);
    expect(geo.urban.wardNumber).toBe("1");
    expect(geo.rural.wardNumber).toBe("1");
    expect(() =>
      createWard(db, {
        classification: "urban",
        urbanLocalBodyId: geo.ulb.id,
        boundaryVersionId: geo.version.id,
        wardNumber: "1",
        name: "dup urban"
      })
    ).toThrow(/unique/);
  });

  it("maps villages only to rural wards in the same Gram Panchayat", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    const mapping = setVillageWard(db, {
      villageId: geo.village.id,
      wardId: geo.rural.id,
      coverageKind: "partial"
    });
    expect(mapping.coverageKind).toBe("partial");
    expect(() =>
      setVillageWard(db, { villageId: geo.village.id, wardId: geo.urban.id, coverageKind: "complete" })
    ).toThrow();
  });

  it("does not expand partial constituency coverage", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    setCoverage(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      unitType: "mandal",
      unitId: geo.mandal.id,
      coverageKind: "partial"
    });
    const scope = resolveScope(db, geo.constituency.id, geo.version.id);
    expect(scope.mandals[geo.mandal.id]).toBe("partial");
    expect(scope.gramPanchayats[geo.gp.id]).toBeUndefined();
    setCoverage(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      unitType: "gram_panchayat",
      unitId: geo.gp.id,
      coverageKind: "complete"
    });
    const expanded = resolveScope(db, geo.constituency.id, geo.version.id);
    expect(expanded.ruralWards[geo.rural.id]).toBeTruthy();
    expect(listMandals(db, { constituencyId: geo.other.id, boundaryVersionId: geo.version.id })).toHaveLength(0);
  });

  it("isolates dashboard counts by constituency without double counting", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    setCoverage(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      unitType: "gram_panchayat",
      unitId: geo.gp.id,
      coverageKind: "complete"
    });
    const counts = dashboardCounts(db, geo.constituency.id, geo.version.id);
    expect(counts.gramPanchayats).toBe(1);
    expect(counts.ruralWards).toBe(2);
    expect(counts.mandals).toBe(1);
    expect(dashboardCounts(db, geo.other.id, geo.version.id).ruralWards).toBe(0);
  });

  it("stores and searches Telugu text", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    const found = listWards(db, { query: "జీపీ", boundaryVersionId: geo.version.id, page: 1, pageSize: 10 });
    expect(found.items.some((w) => w.gramPanchayatId === geo.gp.id)).toBe(true);
    const gpSearch = listWards(db, { query: "Rural", boundaryVersionId: geo.version.id });
    expect(gpSearch.items.some((w) => w.name === "Rural 1")).toBe(true);
  });

  it("preserves archived election geographic snapshots after later edits", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    setCoverage(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      unitType: "gram_panchayat",
      unitId: geo.gp.id,
      coverageKind: "complete"
    });
    const election = createElection(db, {
      name: "Assembly 2026",
      electionType: "assembly",
      year: 2026,
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      wardIds: [geo.rural.id],
      coverage: [{ unitType: "gram_panchayat", unitId: geo.gp.id, coverageKind: "complete" }]
    });
    archiveElection(db, election.id);
    db.prepare("UPDATE wards SET name = ? WHERE id = ?").run("Changed later", geo.rural.id);
    const archived = getElection(db, election.id);
    expect(archived.election.status).toBe("archived");
    expect(archived.wards[0]?.wardNameSnapshot).toBe("Rural 1");
    expect(() =>
      createElection(db, {
        name: "Bad wards",
        electionType: "assembly",
        year: 2026,
        constituencyId: geo.constituency.id,
        boundaryVersionId: geo.version.id,
        wardIds: [geo.urban.id],
        coverage: []
      })
    ).toThrow(/not in the selected constituency coverage/);
  });
});

describe("persistence and backup", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("persists constituencies after reopening the database", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-"));
    dirs.push(dir);
    const manager = new DatabaseManager(resolveDataPaths(dir));
    const db = manager.open();
    createConstituency(db, { name: "Persisted Seat", nameTe: "నిలిచిన సీటు" });
    manager.close();
    const reopened = manager.open();
    const row = reopened.prepare("SELECT name, name_te FROM assembly_constituencies").get() as {
      name: string;
      name_te: string;
    };
    expect(row.name).toBe("Persisted Seat");
    expect(row.name_te).toBe("నిలిచిన సీటు");
    manager.close();
  });

  it("creates a portable backup and restores it; rejects invalid files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-"));
    dirs.push(dir);
    const manager = new DatabaseManager(resolveDataPaths(dir));
    manager.open();
    createConstituency(manager.get(), { name: "Backup Seat" });
    const dest = path.join(dir, "copy.winwinbak");
    const backup = await createBackup(manager, dest);
    expect(fs.existsSync(backup.path)).toBe(true);
    createConstituency(manager.get(), { name: "After backup" });
    await restoreBackup(manager, backup.path, { skipConfirm: true });
    const names = manager.get().prepare("SELECT name FROM assembly_constituencies ORDER BY name").all() as Array<{
      name: string;
    }>;
    expect(names.map((n) => n.name)).toEqual(["Backup Seat"]);
    const bad = path.join(dir, "bad.winwinbak");
    fs.writeFileSync(bad, "not-a-backup");
    await expect(restoreBackup(manager, bad, { skipConfirm: true })).rejects.toBeInstanceOf(AppError);
    manager.close();
  });

  it("reinstates the recovery copy when restore replacement fails", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-"));
    dirs.push(dir);
    const manager = new DatabaseManager(resolveDataPaths(dir));
    manager.open();
    createConstituency(manager.get(), { name: "Keep me" });
    const dest = path.join(dir, "ok.winwinbak");
    await createBackup(manager, dest);
    await expect(restoreBackup(manager, dest, { skipConfirm: true, simulateReplaceFailure: true })).rejects.toBeInstanceOf(
      AppError
    );
    const row = manager.get().prepare("SELECT name FROM assembly_constituencies").get() as { name: string };
    expect(row.name).toBe("Keep me");
    manager.close();
  });

  it("refuses to write a backup over the active database path", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-"));
    dirs.push(dir);
    const manager = new DatabaseManager(resolveDataPaths(dir));
    manager.open();
    await expect(createBackup(manager, manager.paths.databasePath)).rejects.toBeInstanceOf(AppError);
    manager.close();
  });
});

describe("coverage listing", () => {
  it("records explicit coverage rows", () => {
    const db = openMemory();
    const geo = seedGeo(db);
    setCoverage(db, {
      constituencyId: geo.constituency.id,
      boundaryVersionId: geo.version.id,
      unitType: "urban_local_body",
      unitId: geo.ulb.id,
      coverageKind: "partial"
    });
    const rows = listCoverage(db, geo.constituency.id, geo.version.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.coverageKind).toBe("partial");
  });
});
