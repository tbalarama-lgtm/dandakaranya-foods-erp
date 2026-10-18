import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  APP_ID,
  APP_NAME,
  APP_VERSION,
  SCHEMA_VERSION,
  URBAN_BODY_TYPES,
  ELECTION_TYPES,
  WORKSPACE_STATUSES,
  COVERAGE_KINDS,
  UNIT_TYPES
} from "@shared/constants";
import { IpcChannel } from "@shared/ipc";
import { toErrorPayload, AppError } from "../errors";
import type { DatabaseManager } from "../db/connection";
import { listAudit } from "../services/audit";
import { createBackupWithDialog, restoreBackupWithDialog, type BackupDialogs } from "../services/backup";
import { deleteCoverage, listCoverage, resolveScope, setCoverage } from "../services/coverage";
import { dashboardCounts } from "../services/dashboard";
import { loadDemoData } from "../services/demo";
import { archiveElection, createElection, getElection, listElections, updateElection } from "../services/elections";
import {
  archiveConstituency,
  archiveGp,
  archiveMandal,
  archiveUlb,
  archiveVillage,
  createBoundary,
  createConstituency,
  createGp,
  createMandal,
  createUlb,
  createVillage,
  listBoundaries,
  listConstituencies,
  listGps,
  listMandals,
  listUlbs,
  listVillages,
  updateBoundary,
  updateConstituency,
  updateGp,
  updateMandal,
  updateUlb,
  updateVillage
} from "../services/geo";
import { demoStatus, getSettings, updateSettings } from "../services/settings";
import {
  archiveWard,
  createWard,
  deleteVillageWard,
  getWardDetail,
  listVillageWards,
  listWards,
  setVillageWard,
  updateWard
} from "../services/wards";
import { idSchema, namedSchema } from "./schemas";

const optionalId = z.string().min(1).optional();
const coverageKind = z.enum(COVERAGE_KINDS);
const unitType = z.enum(UNIT_TYPES);

function assertSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? event.sender.getURL();
  const trusted =
    url.startsWith("file:") ||
    url.startsWith("http://localhost:") ||
    url.startsWith("http://127.0.0.1:") ||
    url.startsWith("https://localhost:");
  if (!trusted) {
    throw new AppError("ipc_denied", "Blocked IPC from an untrusted frame.");
  }
}

function handle(channel: string, schema: z.ZodType, fn: (input: unknown) => unknown): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    try {
      assertSender(event);
      const input = schema.parse(raw ?? {});
      const data = await fn(input);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: toErrorPayload(error) };
    }
  });
}

export function registerIpc(manager: DatabaseManager, getWindow: () => BrowserWindow | null): void {
  const db = () => manager.get();
  const dialogs = (): BackupDialogs => ({
    async saveFile(defaultName: string) {
      const automated = process.env.WINWIN_TEST_BACKUP_FILE;
      if (automated) {
        fs.mkdirSync(path.dirname(automated), { recursive: true });
        return automated;
      }
      const win = getWindow();
      const options = {
        defaultPath: path.join(manager.paths.backupsDir, defaultName),
        filters: [{ name: "WIN WIN backup", extensions: ["winwinbak"] }]
      };
      const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
      return result.canceled ? null : result.filePath ?? null;
    },
    async openFile() {
      const automated = process.env.WINWIN_TEST_BACKUP_FILE;
      if (automated) return automated;
      const win = getWindow();
      const options = {
        defaultPath: manager.paths.backupsDir,
        filters: [{ name: "WIN WIN backup", extensions: ["winwinbak"] }],
        properties: ["openFile" as const]
      };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
    async confirm(message: string) {
      if (process.env.WINWIN_TEST_BACKUP_FILE) return true;
      const win = getWindow();
      const options = {
        type: "warning" as const,
        buttons: ["Cancel", "Replace data"],
        defaultId: 0,
        cancelId: 0,
        title: "WIN WIN",
        message
      };
      const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
      return result.response === 1;
    }
  });

  handle(IpcChannel.platform, z.object({}), () => ({
    platform: process.platform,
    isMac: process.platform === "darwin",
    modKey: process.platform === "darwin" ? "⌘" : "Ctrl"
  }));

  handle(IpcChannel.appInfo, z.object({}), () => ({
    appId: APP_ID,
    appName: APP_NAME,
    version: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    dataDirectory: manager.paths.dataDir,
    databasePath: manager.paths.databasePath,
    encryptedDatabase: false as const,
    encryptedBackups: false as const
  }));

  handle(IpcChannel.settingsGet, z.object({}), () => getSettings(db()));
  handle(
    IpcChannel.settingsUpdate,
    z.object({
      organizationName: z.string().optional(),
      defaultConstituencyId: z.string().nullable().optional(),
      locale: z.enum(["en", "te"]).optional()
    }),
    (input) => updateSettings(db(), input as Parameters<typeof updateSettings>[1])
  );

  handle(IpcChannel.dashboardCounts, z.object({ constituencyId: z.string(), boundaryVersionId: z.string() }), (input) => {
    const { constituencyId, boundaryVersionId } = input as { constituencyId: string; boundaryVersionId: string };
    return dashboardCounts(db(), constituencyId, boundaryVersionId);
  });

  handle(IpcChannel.boundaryList, z.object({}), () => listBoundaries(db()));
  handle(
    IpcChannel.boundaryCreate,
    z.object({
      name: z.string().min(1),
      effectiveFrom: z.string().min(1),
      effectiveTo: z.string().nullable().optional(),
      notes: z.string().optional(),
      status: z.enum(["draft", "active", "archived"]).optional()
    }),
    (input) => createBoundary(db(), input as Parameters<typeof createBoundary>[1])
  );
  handle(
    IpcChannel.boundaryUpdate,
    z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      effectiveFrom: z.string().optional(),
      effectiveTo: z.string().nullable().optional(),
      notes: z.string().optional(),
      status: z.enum(["draft", "active", "archived"]).optional()
    }),
    (input) => updateBoundary(db(), input as Parameters<typeof updateBoundary>[1])
  );

  handle(IpcChannel.constituencyList, z.object({ includeArchived: z.boolean().optional() }), (input) =>
    listConstituencies(db(), Boolean((input as { includeArchived?: boolean }).includeArchived))
  );
  handle(IpcChannel.constituencyCreate, namedSchema, (input) => createConstituency(db(), input as Parameters<typeof createConstituency>[1]));
  handle(
    IpcChannel.constituencyUpdate,
    namedSchema.extend({ id: z.string().min(1), archived: z.boolean().optional() }),
    (input) => updateConstituency(db(), input as Parameters<typeof updateConstituency>[1])
  );
  handle(IpcChannel.constituencyArchive, idSchema, (input) => archiveConstituency(db(), (input as { id: string }).id));

  handle(
    IpcChannel.mandalList,
    z.object({ constituencyId: optionalId, boundaryVersionId: optionalId, includeArchived: z.boolean().optional() }),
    (input) => listMandals(db(), input as Parameters<typeof listMandals>[1])
  );
  handle(IpcChannel.mandalCreate, namedSchema, (input) => createMandal(db(), input as Parameters<typeof createMandal>[1]));
  handle(IpcChannel.mandalUpdate, namedSchema.extend({ id: z.string().min(1) }), (input) =>
    updateMandal(db(), input as Parameters<typeof updateMandal>[1])
  );
  handle(IpcChannel.mandalArchive, idSchema, (input) => archiveMandal(db(), (input as { id: string }).id));

  handle(
    IpcChannel.gpList,
    z.object({
      mandalId: optionalId,
      constituencyId: optionalId,
      boundaryVersionId: optionalId,
      includeArchived: z.boolean().optional()
    }),
    (input) => listGps(db(), input as Parameters<typeof listGps>[1])
  );
  handle(IpcChannel.gpCreate, namedSchema.extend({ mandalId: z.string().min(1) }), (input) =>
    createGp(db(), input as Parameters<typeof createGp>[1])
  );
  handle(IpcChannel.gpUpdate, namedSchema.extend({ id: z.string().min(1), mandalId: optionalId }), (input) =>
    updateGp(db(), input as Parameters<typeof updateGp>[1])
  );
  handle(IpcChannel.gpArchive, idSchema, (input) => archiveGp(db(), (input as { id: string }).id));

  handle(
    IpcChannel.villageList,
    z.object({
      gramPanchayatId: optionalId,
      constituencyId: optionalId,
      boundaryVersionId: optionalId,
      includeArchived: z.boolean().optional()
    }),
    (input) => listVillages(db(), input as Parameters<typeof listVillages>[1])
  );
  handle(IpcChannel.villageCreate, namedSchema.extend({ gramPanchayatId: z.string().min(1) }), (input) =>
    createVillage(db(), input as Parameters<typeof createVillage>[1])
  );
  handle(IpcChannel.villageUpdate, namedSchema.extend({ id: z.string().min(1), gramPanchayatId: optionalId }), (input) =>
    updateVillage(db(), input as Parameters<typeof updateVillage>[1])
  );
  handle(IpcChannel.villageArchive, idSchema, (input) => archiveVillage(db(), (input as { id: string }).id));

  handle(
    IpcChannel.ulbList,
    z.object({ constituencyId: optionalId, boundaryVersionId: optionalId, includeArchived: z.boolean().optional() }),
    (input) => listUlbs(db(), input as Parameters<typeof listUlbs>[1])
  );
  handle(
    IpcChannel.ulbCreate,
    namedSchema.extend({
      bodyType: z.enum(URBAN_BODY_TYPES),
      administrativeMandalId: z.string().nullable().optional()
    }),
    (input) => createUlb(db(), input as Parameters<typeof createUlb>[1])
  );
  handle(
    IpcChannel.ulbUpdate,
    namedSchema.extend({
      id: z.string().min(1),
      bodyType: z.enum(URBAN_BODY_TYPES).optional(),
      administrativeMandalId: z.string().nullable().optional()
    }),
    (input) => updateUlb(db(), input as Parameters<typeof updateUlb>[1])
  );
  handle(IpcChannel.ulbArchive, idSchema, (input) => archiveUlb(db(), (input as { id: string }).id));

  handle(
    IpcChannel.wardList,
    z.object({
      query: z.string().optional(),
      constituencyId: z.string().nullable().optional(),
      classification: z.union([z.enum(["rural", "urban"]), z.literal("")]).optional(),
      mandalId: z.string().nullable().optional(),
      localBodyId: z.string().nullable().optional(),
      boundaryVersionId: optionalId,
      includeArchived: z.boolean().optional(),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().max(200).optional()
    }),
    (input) => listWards(db(), input as Parameters<typeof listWards>[1])
  );
  handle(IpcChannel.wardGet, idSchema, (input) => getWardDetail(db(), (input as { id: string }).id));
  const wardWrite = z.object({
    classification: z.enum(["rural", "urban"]),
    gramPanchayatId: z.string().nullable().optional(),
    urbanLocalBodyId: z.string().nullable().optional(),
    boundaryVersionId: z.string().min(1),
    wardNumber: z.string().min(1),
    name: z.string().min(1),
    nameTe: z.string().optional(),
    officialCode: z.string().nullable().optional(),
    recordSource: z.string().optional(),
    lastVerifiedAt: z.string().nullable().optional(),
    notes: z.string().optional()
  });
  handle(IpcChannel.wardCreate, wardWrite, (input) => createWard(db(), input as Parameters<typeof createWard>[1]));
  handle(IpcChannel.wardUpdate, wardWrite.extend({ id: z.string().min(1) }), (input) =>
    updateWard(db(), input as Parameters<typeof updateWard>[1])
  );
  handle(IpcChannel.wardArchive, idSchema, (input) => archiveWard(db(), (input as { id: string }).id));

  handle(IpcChannel.villageWardList, z.object({ wardId: z.string().min(1) }), (input) =>
    listVillageWards(db(), (input as { wardId: string }).wardId)
  );
  handle(
    IpcChannel.villageWardSet,
    z.object({
      villageId: z.string().min(1),
      wardId: z.string().min(1),
      coverageKind,
      notes: z.string().optional()
    }),
    (input) => setVillageWard(db(), input as Parameters<typeof setVillageWard>[1])
  );
  handle(IpcChannel.villageWardDelete, idSchema, (input) => deleteVillageWard(db(), (input as { id: string }).id));

  handle(
    IpcChannel.coverageList,
    z.object({ constituencyId: z.string(), boundaryVersionId: z.string() }),
    (input) =>
      listCoverage(
        db(),
        (input as { constituencyId: string }).constituencyId,
        (input as { boundaryVersionId: string }).boundaryVersionId
      )
  );
  handle(
    IpcChannel.coverageSet,
    z.object({
      constituencyId: z.string(),
      boundaryVersionId: z.string(),
      unitType,
      unitId: z.string().min(1),
      coverageKind,
      notes: z.string().optional()
    }),
    (input) => setCoverage(db(), input as Parameters<typeof setCoverage>[1])
  );
  handle(IpcChannel.coverageDelete, idSchema, (input) => deleteCoverage(db(), (input as { id: string }).id));
  handle(IpcChannel.scopeGet, z.object({ constituencyId: z.string(), boundaryVersionId: z.string() }), (input) =>
    resolveScope(
      db(),
      (input as { constituencyId: string }).constituencyId,
      (input as { boundaryVersionId: string }).boundaryVersionId
    )
  );

  const electionWrite = z.object({
    name: z.string().min(1),
    electionType: z.enum(ELECTION_TYPES),
    year: z.number().int(),
    constituencyId: z.string().min(1),
    boundaryVersionId: z.string().min(1),
    status: z.enum(WORKSPACE_STATUSES).optional(),
    notes: z.string().optional(),
    wardIds: z.array(z.string()),
    coverage: z.array(z.object({ unitType, unitId: z.string(), coverageKind }))
  });
  handle(
    IpcChannel.electionList,
    z.object({ constituencyId: optionalId, includeArchived: z.boolean().optional() }),
    (input) => listElections(db(), input as Parameters<typeof listElections>[1])
  );
  handle(IpcChannel.electionGet, idSchema, (input) => getElection(db(), (input as { id: string }).id));
  handle(IpcChannel.electionCreate, electionWrite, (input) => createElection(db(), input as Parameters<typeof createElection>[1]));
  handle(IpcChannel.electionUpdate, electionWrite.extend({ id: z.string().min(1) }), (input) =>
    updateElection(db(), input as Parameters<typeof updateElection>[1])
  );
  handle(IpcChannel.electionArchive, idSchema, (input) => archiveElection(db(), (input as { id: string }).id));

  handle(
    IpcChannel.auditList,
    z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().optional() }),
    (input) => {
      const { page, pageSize } = input as { page?: number; pageSize?: number };
      return listAudit(db(), page, pageSize);
    }
  );

  handle(IpcChannel.backupCreate, z.object({}), () => createBackupWithDialog(manager, dialogs()));
  handle(IpcChannel.backupRestore, z.object({}), () => restoreBackupWithDialog(manager, dialogs()));
  handle(IpcChannel.demoLoad, z.object({}), () => loadDemoData(db()));
  handle(IpcChannel.demoStatus, z.object({}), () => demoStatus(db()));
}
