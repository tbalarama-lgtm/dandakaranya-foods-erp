import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
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
  UNIT_TYPES,
  CONSENT_STATUSES,
  ASSIGNMENT_STATUSES,
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  TASK_STATUSES,
  ISSUE_CATEGORIES,
  VERIFICATION_STATUSES,
  DUPLICATE_PAIR_STATUSES,
  VOTER_EXPORT_FIELDS
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
import {
  archiveContact,
  archivePerson,
  createAssignment,
  createContact,
  createIssue,
  createPerson,
  createTask,
  listAssignments,
  listContacts,
  listIssues,
  listPersons,
  listTasks,
  getIssue,
  updateAssignment,
  updateContact,
  updateIssue,
  updatePerson,
  updateTask,
  wardOverview
} from "../services/workspace";
import { idSchema, mappingSchema, namedSchema, voterFilters } from "./schemas";
import { exportVotersCsv, exportVotersXlsx } from "../services/export-voters";
import {
  assignStagedWards,
  cancelImport,
  commitImport,
  createSession,
  errorReportCsv,
  errorReportFromSession,
  inspectSpreadsheet,
  listStaged,
  readTabularFile,
  reviewIdentifiers,
  selectSheet,
  setEdition,
  setMapping,
  sha256File,
  templateCsv,
  templateXlsx,
  validateSession
} from "../services/import-voters";
import {
  archiveEdition,
  archiveVoter,
  assignWardsBulk,
  createEdition,
  createVoter,
  editionCounts,
  findDuplicates,
  getVoterDetail,
  listEditions,
  listVoters,
  listVotersForExport,
  reviewDuplicate,
  updateVoter
} from "../services/voters";

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
      const automated = !app.isPackaged ? process.env.WINWIN_TEST_BACKUP_FILE : undefined;
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
      const automated = !app.isPackaged ? process.env.WINWIN_TEST_BACKUP_FILE : undefined;
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
      if (!app.isPackaged && process.env.WINWIN_TEST_BACKUP_FILE) return true;
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

  const personWrite = z.object({
    name: z.string().min(1),
    nameTe: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    consentStatus: z.enum(CONSENT_STATUSES),
    consentDate: z.string().nullable().optional(),
    consentSource: z.string().optional()
  });
  handle(IpcChannel.personList, z.object({ query: z.string().optional(), includeArchived: z.boolean().optional() }), (input) =>
    listPersons(db(), input as Parameters<typeof listPersons>[1])
  );
  handle(IpcChannel.personCreate, personWrite, (input) => createPerson(db(), input as Parameters<typeof createPerson>[1]));
  handle(IpcChannel.personUpdate, personWrite.extend({ id: z.string().min(1) }), (input) =>
    updatePerson(db(), input as Parameters<typeof updatePerson>[1])
  );
  handle(IpcChannel.personArchive, idSchema, (input) => archivePerson(db(), (input as { id: string }).id));

  const contactWrite = z.object({
    personId: z.string().min(1).optional(),
    person: personWrite.optional(),
    wardId: z.string().min(1),
    constituencyId: z.string().min(1),
    organization: z.string().optional(),
    publicRole: z.string().optional(),
    areaServed: z.string().optional(),
    recordSource: z.string().optional(),
    lastVerifiedAt: z.string().nullable().optional(),
    coordinationNotes: z.string().optional()
  });
  handle(
    IpcChannel.contactList,
    z.object({
      wardId: z.string().min(1),
      constituencyId: z.string().min(1),
      query: z.string().optional(),
      includeArchived: z.boolean().optional(),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().max(200).optional()
    }),
    (input) => listContacts(db(), input as Parameters<typeof listContacts>[1])
  );
  handle(IpcChannel.contactCreate, contactWrite, (input) => createContact(db(), input as Parameters<typeof createContact>[1]));
  handle(IpcChannel.contactUpdate, contactWrite.extend({ id: z.string().min(1) }), (input) =>
    updateContact(db(), input as Parameters<typeof updateContact>[1])
  );
  handle(IpcChannel.contactArchive, z.object({ id: z.string().min(1), constituencyId: z.string().min(1) }), (input) => {
    const { id, constituencyId } = input as { id: string; constituencyId: string };
    archiveContact(db(), id, constituencyId);
  });

  const assignmentWrite = z.object({
    personId: z.string().min(1),
    wardId: z.string().min(1),
    constituencyId: z.string().min(1),
    operationalRole: z.string().min(1),
    responsibilities: z.string().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    status: z.enum(ASSIGNMENT_STATUSES).optional()
  });
  handle(
    IpcChannel.teamList,
    z.object({
      wardId: z.string().min(1),
      constituencyId: z.string().min(1),
      includeInactive: z.boolean().optional()
    }),
    (input) => listAssignments(db(), input as Parameters<typeof listAssignments>[1])
  );
  handle(IpcChannel.teamCreate, assignmentWrite, (input) => createAssignment(db(), input as Parameters<typeof createAssignment>[1]));
  handle(IpcChannel.teamUpdate, assignmentWrite.extend({ id: z.string().min(1) }), (input) =>
    updateAssignment(db(), input as Parameters<typeof updateAssignment>[1])
  );

  const issueWrite = z.object({
    wardId: z.string().min(1),
    constituencyId: z.string().min(1),
    title: z.string().min(1),
    category: z.enum(ISSUE_CATEGORIES),
    location: z.string().optional(),
    description: z.string().optional(),
    reportedAt: z.string().min(1),
    responsiblePersonId: z.string().nullable().optional(),
    priority: z.enum(ISSUE_PRIORITIES),
    dueDate: z.string().nullable().optional(),
    status: z.enum(ISSUE_STATUSES).optional(),
    resolutionNotes: z.string().optional(),
    complainantName: z.string().optional()
  });
  handle(
    IpcChannel.issueList,
    z.object({
      wardId: z.string().min(1),
      constituencyId: z.string().min(1),
      query: z.string().optional(),
      category: z.string().optional(),
      status: z.union([z.enum(ISSUE_STATUSES), z.literal("")]).optional(),
      priority: z.union([z.enum(ISSUE_PRIORITIES), z.literal("")]).optional(),
      responsiblePersonId: z.union([z.string(), z.literal("")]).optional(),
      includeArchived: z.boolean().optional(),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().max(200).optional()
    }),
    (input) => listIssues(db(), input as Parameters<typeof listIssues>[1])
  );
  handle(IpcChannel.issueGet, z.object({ id: z.string().min(1), constituencyId: z.string().min(1) }), (input) => {
    const { id, constituencyId } = input as { id: string; constituencyId: string };
    return getIssue(db(), id, constituencyId);
  });
  handle(IpcChannel.issueCreate, issueWrite, (input) => createIssue(db(), input as Parameters<typeof createIssue>[1]));
  handle(IpcChannel.issueUpdate, issueWrite.extend({ id: z.string().min(1) }), (input) =>
    updateIssue(db(), input as Parameters<typeof updateIssue>[1])
  );

  const taskWrite = z.object({
    wardId: z.string().min(1),
    constituencyId: z.string().min(1),
    title: z.string().min(1),
    assignedPersonId: z.string().nullable().optional(),
    relatedIssueId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    description: z.string().optional(),
    completedAt: z.string().nullable().optional(),
    completionNotes: z.string().optional(),
    allowInactiveAssignee: z.boolean().optional()
  });
  handle(
    IpcChannel.taskList,
    z.object({
      wardId: z.string().min(1),
      constituencyId: z.string().min(1),
      query: z.string().optional(),
      status: z.union([z.enum(TASK_STATUSES), z.literal("")]).optional(),
      assignedPersonId: z.union([z.string(), z.literal("")]).optional(),
      filter: z.enum(["overdue", "upcoming", "completed", "open", ""]).optional(),
      includeArchived: z.boolean().optional(),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().max(200).optional()
    }),
    (input) => listTasks(db(), input as Parameters<typeof listTasks>[1])
  );
  handle(IpcChannel.taskCreate, taskWrite, (input) => createTask(db(), input as Parameters<typeof createTask>[1]));
  handle(IpcChannel.taskUpdate, taskWrite.extend({ id: z.string().min(1) }), (input) =>
    updateTask(db(), input as Parameters<typeof updateTask>[1])
  );
  handle(
    IpcChannel.wardOverview,
    z.object({ wardId: z.string().min(1), constituencyId: z.string().min(1) }),
    (input) => wardOverview(db(), input as Parameters<typeof wardOverview>[1])
  );

  handle(
    IpcChannel.editionList,
    z.object({ constituencyId: z.string().min(1), includeArchived: z.boolean().optional() }),
    (input) => {
      const { constituencyId, includeArchived } = input as { constituencyId: string; includeArchived?: boolean };
      return listEditions(db(), constituencyId, Boolean(includeArchived));
    }
  );
  handle(
    IpcChannel.editionCreate,
    z.object({
      constituencyId: z.string().min(1),
      boundaryVersionId: z.string().min(1),
      name: z.string().min(1),
      revisionCode: z.string().optional(),
      publishedOn: z.string().nullable().optional(),
      notes: z.string().optional()
    }),
    (input) => createEdition(db(), input as Parameters<typeof createEdition>[1])
  );
  handle(
    IpcChannel.editionArchive,
    z.object({ id: z.string().min(1), constituencyId: z.string().min(1) }),
    (input) => {
      const { id, constituencyId } = input as { id: string; constituencyId: string };
      return archiveEdition(db(), id, constituencyId);
    }
  );
  handle(
    IpcChannel.editionCounts,
    z.object({ constituencyId: z.string().min(1), rollEditionId: z.string().min(1) }),
    (input) => editionCounts(db(), (input as { constituencyId: string }).constituencyId, (input as { rollEditionId: string }).rollEditionId)
  );

  const voterWrite = z.object({
    rollEditionId: z.string().min(1),
    constituencyId: z.string().min(1),
    sourceName: z.string().optional(),
    sourceNameEn: z.string().optional(),
    sourceElectoralId: z.string().optional(),
    sourceRollSerial: z.string().optional(),
    sourceAge: z.string().optional(),
    sourceAgeReferenceDate: z.string().optional(),
    sourceAddress: z.string().optional(),
    sourceSection: z.string().optional(),
    sourcePage: z.string().optional(),
    assignedWardId: z.string().nullable().optional(),
    verificationStatus: z.enum(VERIFICATION_STATUSES).optional()
  });
  handle(IpcChannel.voterList, voterFilters, (input) => listVoters(db(), input as Parameters<typeof listVoters>[1]));
  handle(IpcChannel.voterGet, z.object({ id: z.string().min(1), constituencyId: z.string().min(1) }), (input) => {
    const { id, constituencyId } = input as { id: string; constituencyId: string };
    return getVoterDetail(db(), id, constituencyId);
  });
  handle(IpcChannel.voterCreate, voterWrite, (input) => createVoter(db(), input as Parameters<typeof createVoter>[1]));
  handle(
    IpcChannel.voterUpdate,
    z.object({
      id: z.string().min(1),
      constituencyId: z.string().min(1),
      localName: z.string().nullable().optional(),
      localNameEn: z.string().nullable().optional(),
      localElectoralId: z.string().nullable().optional(),
      localRollSerial: z.string().nullable().optional(),
      localAge: z.string().nullable().optional(),
      localAgeReferenceDate: z.string().nullable().optional(),
      localAddress: z.string().nullable().optional(),
      assignedWardId: z.string().nullable().optional(),
      verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
      verifiedAt: z.string().nullable().optional()
    }),
    (input) => updateVoter(db(), input as Parameters<typeof updateVoter>[1])
  );
  handle(
    IpcChannel.voterArchive,
    z.object({ id: z.string().min(1), constituencyId: z.string().min(1), reason: z.string().min(1) }),
    (input) => {
      const { id, constituencyId, reason } = input as { id: string; constituencyId: string; reason: string };
      return archiveVoter(db(), id, constituencyId, reason);
    }
  );
  handle(
    IpcChannel.voterAssignBulk,
    z.object({
      constituencyId: z.string().min(1),
      voterIds: z.array(z.string().min(1)).min(1),
      wardId: z.string().nullable(),
      reason: z.string().min(1),
      verificationSource: z.string().optional()
    }),
    (input) => ({ updated: assignWardsBulk(db(), input as Parameters<typeof assignWardsBulk>[1]) })
  );

  async function savePath(kind: "import" | "export" | "template" | "errors", defaultName: string, filters: Electron.FileFilter[]): Promise<string | null> {
    const envKey =
      kind === "import"
        ? "WINWIN_TEST_IMPORT_FILE"
        : kind === "export"
          ? "WINWIN_TEST_EXPORT_FILE"
          : kind === "template"
            ? "WINWIN_TEST_TEMPLATE_FILE"
            : "WINWIN_TEST_ERROR_REPORT_FILE";
    const automated = !app.isPackaged ? process.env[envKey] : undefined;
    if (automated) {
      fs.mkdirSync(path.dirname(automated), { recursive: true });
      return automated;
    }
    const win = getWindow();
    const options = { defaultPath: path.join(manager.paths.backupsDir, defaultName), filters };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    return result.canceled ? null : result.filePath ?? null;
  }

  handle(
    IpcChannel.voterExport,
    z.object({
      filters: voterFilters,
      fields: z.array(z.enum(VOTER_EXPORT_FIELDS)).min(1),
      format: z.enum(["csv", "xlsx"])
    }),
    async (input) => {
      const { filters, fields, format } = input as {
        filters: Parameters<typeof listVotersForExport>[1];
        fields: string[];
        format: "csv" | "xlsx";
      };
      const items = listVotersForExport(db(), filters);
      const dest = await savePath(
        "export",
        format === "xlsx" ? "voters.xlsx" : "voters.csv",
        format === "xlsx"
          ? [{ name: "Excel", extensions: ["xlsx"] }]
          : [{ name: "CSV", extensions: ["csv"] }]
      );
      if (!dest) return { cancelled: true };
      if (format === "xlsx") fs.writeFileSync(dest, await exportVotersXlsx(items, fields));
      else fs.writeFileSync(dest, exportVotersCsv(items, fields), "utf8");
      return { cancelled: false, path: dest, count: items.length };
    }
  );

  const reportImportProgress = (progress: { phase: "read" | "validate" | "commit"; processed: number; total: number; message: string }) => {
    getWindow()?.webContents.send("winwin:import-progress", progress);
  };

  handle(IpcChannel.importOpen, z.object({ constituencyId: z.string().min(1) }), async (input) => {
    const constituencyId = (input as { constituencyId: string }).constituencyId;
    const automated = !app.isPackaged ? process.env.WINWIN_TEST_IMPORT_FILE : undefined;
    let filePath: string | null = automated ?? null;
    if (!filePath) {
      const win = getWindow();
      const options = {
        filters: [{ name: "CSV or Excel", extensions: ["csv", "xlsx", "txt"] }],
        properties: ["openFile" as const]
      };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      filePath = result.canceled ? null : result.filePaths[0] ?? null;
    }
    if (!filePath) return { cancelled: true as const };
    const inspected = await inspectSpreadsheet(filePath);
    const sha = sha256File(filePath);
    if (inspected.worksheets.length > 1) {
      return createSession(db(), {
        constituencyId,
        columns: [],
        rows: [],
        cells: [],
        fileName: path.basename(filePath),
        sha,
        filePath,
        worksheets: inspected.worksheets,
        selectedSheet: null,
        headerWarnings: []
      });
    }
    const table = await readTabularFile(filePath, {
      sheetName: inspected.worksheets[0]?.name,
      onProgress: reportImportProgress
    });
    return createSession(db(), {
      constituencyId,
      columns: table.columns,
      rows: table.rows,
      cells: table.cells,
      fileName: path.basename(filePath),
      sha,
      filePath,
      formulaMask: table.formulaMask,
      formulaCellCount: table.formulaCellCount,
      numericCoercionCount: table.numericCoercionCount,
      headerWarnings: table.headerWarnings,
      worksheets: table.worksheets,
      selectedSheet: table.selectedSheet
    });
  });
  handle(
    IpcChannel.importSelectSheet,
    z.object({ sessionId: z.string().min(1), sheetName: z.string().min(1) }),
    (input) => {
      const { sessionId, sheetName } = input as { sessionId: string; sheetName: string };
      return selectSheet(db(), sessionId, sheetName, reportImportProgress);
    }
  );
  handle(
    IpcChannel.importSetEdition,
    z.object({ sessionId: z.string().min(1), rollEditionId: z.string().min(1) }),
    (input) => {
      const { sessionId, rollEditionId } = input as { sessionId: string; rollEditionId: string };
      return setEdition(db(), sessionId, rollEditionId);
    }
  );
  handle(
    IpcChannel.importSetMapping,
    z.object({ sessionId: z.string().min(1), mapping: mappingSchema }),
    (input) => {
      const { sessionId, mapping } = input as { sessionId: string; mapping: Parameters<typeof setMapping>[1] };
      return setMapping(sessionId, mapping);
    }
  );
  handle(IpcChannel.importValidate, z.object({ sessionId: z.string().min(1) }), (input) =>
    validateSession(db(), (input as { sessionId: string }).sessionId, reportImportProgress)
  );
  handle(
    IpcChannel.importListStaged,
    z.object({
      sessionId: z.string().min(1),
      kind: z.enum(["review", "identifier", "rejected", "unassigned", "all"]).optional(),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().max(200).optional()
    }),
    (input) => listStaged((input as { sessionId: string }).sessionId, input as Parameters<typeof listStaged>[1])
  );
  handle(
    IpcChannel.importReviewIdentifiers,
    z.object({
      sessionId: z.string().min(1),
      items: z
        .array(
          z.object({
            sourceRowNumber: z.number().int().positive(),
            field: z.enum(["electoralId", "rollSerial", "wardNumber"]),
            action: z.enum(["accept-raw", "correct"]),
            value: z.string().optional()
          })
        )
        .min(1)
    }),
    (input) => {
      const { sessionId, items } = input as {
        sessionId: string;
        items: Array<{
          sourceRowNumber: number;
          field: "electoralId" | "rollSerial" | "wardNumber";
          action: "accept-raw" | "correct";
          value?: string;
        }>;
      };
      return reviewIdentifiers(db(), sessionId, items);
    }
  );
  handle(
    IpcChannel.importAssignStaged,
    z.object({
      sessionId: z.string().min(1),
      sourceRowNumbers: z.array(z.number().int().positive()).min(1),
      wardId: z.string().nullable()
    }),
    (input) => {
      const { sessionId, sourceRowNumbers, wardId } = input as {
        sessionId: string;
        sourceRowNumbers: number[];
        wardId: string | null;
      };
      return assignStagedWards(db(), sessionId, sourceRowNumbers, wardId);
    }
  );
  handle(
    IpcChannel.importCommit,
    z.object({ sessionId: z.string().min(1), acknowledgeRepeat: z.boolean().optional() }),
    (input) => {
      const { sessionId, acknowledgeRepeat } = input as { sessionId: string; acknowledgeRepeat?: boolean };
      return commitImport(db(), sessionId, Boolean(acknowledgeRepeat), reportImportProgress);
    }
  );
  handle(IpcChannel.importCancel, z.object({ sessionId: z.string().min(1) }), (input) => {
    cancelImport((input as { sessionId: string }).sessionId);
  });
  handle(IpcChannel.importTemplate, z.object({ format: z.enum(["csv", "xlsx"]) }), async (input) => {
    const format = (input as { format: "csv" | "xlsx" }).format;
    const dest = await savePath(
      "template",
      format === "xlsx" ? "win-win-voter-template.xlsx" : "win-win-voter-template.csv",
      format === "xlsx" ? [{ name: "Excel", extensions: ["xlsx"] }] : [{ name: "CSV", extensions: ["csv"] }]
    );
    if (!dest) return { cancelled: true };
    if (format === "xlsx") fs.writeFileSync(dest, await templateXlsx());
    else fs.writeFileSync(dest, templateCsv(), "utf8");
    return { cancelled: false, path: dest };
  });
  handle(
    IpcChannel.importErrorReport,
    z.object({
      sessionId: z.string().min(1).optional(),
      issues: z.array(z.object({ sourceRowNumber: z.number(), field: z.string(), message: z.string() })).optional()
    }),
    async (input) => {
      const { sessionId, issues } = input as {
        sessionId?: string;
        issues?: Array<{ sourceRowNumber: number; field: string; message: string }>;
      };
      const dest = await savePath("errors", "import-errors.csv", [{ name: "CSV", extensions: ["csv"] }]);
      if (!dest) return { cancelled: true };
      const csv = sessionId
        ? errorReportFromSession(sessionId)
        : errorReportCsv({
            rows: [],
            rowsTruncated: false,
            errorCount: issues?.length ?? 0,
            unassignedCount: 0,
            ambiguousCount: 0,
            assignedCount: 0,
            rejectedCount: 0,
            identifierReviewCount: 0,
            emptySkipped: 0,
            eligibleCount: 0,
            issues: issues ?? []
          });
      fs.writeFileSync(dest, csv, "utf8");
      return { cancelled: false, path: dest };
    }
  );
  handle(
    IpcChannel.duplicateList,
    z.object({ constituencyId: z.string().min(1), rollEditionId: z.string().min(1) }),
    (input) => {
      const { constituencyId, rollEditionId } = input as { constituencyId: string; rollEditionId: string };
      return findDuplicates(db(), constituencyId, rollEditionId);
    }
  );
  handle(
    IpcChannel.duplicateReview,
    z.object({
      id: z.string().min(1),
      constituencyId: z.string().min(1),
      status: z.enum(DUPLICATE_PAIR_STATUSES)
    }),
    (input) => reviewDuplicate(db(), input as Parameters<typeof reviewDuplicate>[1])
  );
}
