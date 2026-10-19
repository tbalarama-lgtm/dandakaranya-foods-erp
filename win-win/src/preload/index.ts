import { contextBridge, ipcRenderer } from "electron";
import { IpcChannel, type WinWinApi } from "@shared/ipc";

async function invoke<T>(channel: string, payload: unknown = {}): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };
  if (!result || typeof result !== "object" || !("ok" in result)) {
    throw new Error("Malformed IPC response");
  }
  if (!result.ok) {
    const error = new Error(result.error.message);
    (error as Error & { code: string }).code = result.error.code;
    throw error;
  }
  return result.data;
}

const api: WinWinApi = {
  platform: () => invoke(IpcChannel.platform),
  appInfo: () => invoke(IpcChannel.appInfo),
  settingsGet: () => invoke(IpcChannel.settingsGet),
  settingsUpdate: (input) => invoke(IpcChannel.settingsUpdate, input),
  dashboardCounts: (input) => invoke(IpcChannel.dashboardCounts, input),
  dashboardAttention: (input) => invoke(IpcChannel.dashboardAttention, input),
  geoDashboard: (input) => invoke(IpcChannel.geoDashboard, input),
  boundaryList: () => invoke(IpcChannel.boundaryList),
  boundaryCreate: (input) => invoke(IpcChannel.boundaryCreate, input),
  boundaryUpdate: (input) => invoke(IpcChannel.boundaryUpdate, input),
  constituencyList: (includeArchived) => invoke(IpcChannel.constituencyList, { includeArchived }),
  constituencyCreate: (input) => invoke(IpcChannel.constituencyCreate, input),
  constituencyUpdate: (input) => invoke(IpcChannel.constituencyUpdate, input),
  constituencyArchive: (id) => invoke(IpcChannel.constituencyArchive, { id }),
  mandalList: (input) => invoke(IpcChannel.mandalList, input ?? {}),
  mandalCreate: (input) => invoke(IpcChannel.mandalCreate, input),
  mandalUpdate: (input) => invoke(IpcChannel.mandalUpdate, input),
  mandalArchive: (id) => invoke(IpcChannel.mandalArchive, { id }),
  gpList: (input) => invoke(IpcChannel.gpList, input ?? {}),
  gpCreate: (input) => invoke(IpcChannel.gpCreate, input),
  gpUpdate: (input) => invoke(IpcChannel.gpUpdate, input),
  gpArchive: (id) => invoke(IpcChannel.gpArchive, { id }),
  villageList: (input) => invoke(IpcChannel.villageList, input ?? {}),
  villageCreate: (input) => invoke(IpcChannel.villageCreate, input),
  villageUpdate: (input) => invoke(IpcChannel.villageUpdate, input),
  villageArchive: (id) => invoke(IpcChannel.villageArchive, { id }),
  ulbList: (input) => invoke(IpcChannel.ulbList, input ?? {}),
  ulbCreate: (input) => invoke(IpcChannel.ulbCreate, input),
  ulbUpdate: (input) => invoke(IpcChannel.ulbUpdate, input),
  ulbArchive: (id) => invoke(IpcChannel.ulbArchive, { id }),
  wardList: (input) => invoke(IpcChannel.wardList, input),
  wardGet: (id) => invoke(IpcChannel.wardGet, { id }),
  wardCreate: (input) => invoke(IpcChannel.wardCreate, input),
  wardUpdate: (input) => invoke(IpcChannel.wardUpdate, input),
  wardArchive: (id) => invoke(IpcChannel.wardArchive, { id }),
  villageWardList: (wardId) => invoke(IpcChannel.villageWardList, { wardId }),
  villageWardSet: (input) => invoke(IpcChannel.villageWardSet, input),
  villageWardDelete: (id) => invoke(IpcChannel.villageWardDelete, { id }),
  coverageList: (input) => invoke(IpcChannel.coverageList, input),
  coverageSet: (input) => invoke(IpcChannel.coverageSet, input),
  coverageDelete: (id) => invoke(IpcChannel.coverageDelete, { id }),
  scopeGet: (input) => invoke(IpcChannel.scopeGet, input),
  electionList: (input) => invoke(IpcChannel.electionList, input ?? {}),
  electionGet: (id) => invoke(IpcChannel.electionGet, { id }),
  electionCreate: (input) => invoke(IpcChannel.electionCreate, input),
  electionUpdate: (input) => invoke(IpcChannel.electionUpdate, input),
  electionArchive: (id) => invoke(IpcChannel.electionArchive, { id }),
  auditList: (input) => invoke(IpcChannel.auditList, input ?? {}),
  backupCreate: () => invoke(IpcChannel.backupCreate),
  backupRestore: () => invoke(IpcChannel.backupRestore),
  demoLoad: () => invoke(IpcChannel.demoLoad),
  demoStatus: () => invoke(IpcChannel.demoStatus),
  personList: (input) => invoke(IpcChannel.personList, input ?? {}),
  personCreate: (input) => invoke(IpcChannel.personCreate, input),
  personUpdate: (input) => invoke(IpcChannel.personUpdate, input),
  personArchive: (id) => invoke(IpcChannel.personArchive, { id }),
  contactList: (input) => invoke(IpcChannel.contactList, input),
  contactCreate: (input) => invoke(IpcChannel.contactCreate, input),
  contactUpdate: (input) => invoke(IpcChannel.contactUpdate, input),
  contactArchive: (input) => invoke(IpcChannel.contactArchive, input),
  teamList: (input) => invoke(IpcChannel.teamList, input),
  teamCreate: (input) => invoke(IpcChannel.teamCreate, input),
  teamUpdate: (input) => invoke(IpcChannel.teamUpdate, input),
  issueList: (input) => invoke(IpcChannel.issueList, input),
  issueGet: (input) => invoke(IpcChannel.issueGet, input),
  issueCreate: (input) => invoke(IpcChannel.issueCreate, input),
  issueUpdate: (input) => invoke(IpcChannel.issueUpdate, input),
  taskList: (input) => invoke(IpcChannel.taskList, input),
  taskCreate: (input) => invoke(IpcChannel.taskCreate, input),
  taskUpdate: (input) => invoke(IpcChannel.taskUpdate, input),
  wardOverview: (input) => invoke(IpcChannel.wardOverview, input),
  editionList: (input) => invoke(IpcChannel.editionList, input),
  editionCreate: (input) => invoke(IpcChannel.editionCreate, input),
  editionArchive: (input) => invoke(IpcChannel.editionArchive, input),
  editionCounts: (input) => invoke(IpcChannel.editionCounts, input),
  voterList: (input) => invoke(IpcChannel.voterList, input),
  voterGet: (input) => invoke(IpcChannel.voterGet, input),
  voterCreate: (input) => invoke(IpcChannel.voterCreate, input),
  voterUpdate: (input) => invoke(IpcChannel.voterUpdate, input),
  voterArchive: (input) => invoke(IpcChannel.voterArchive, input),
  voterAssignBulk: (input) => invoke(IpcChannel.voterAssignBulk, input),
  voterExport: (input) => invoke(IpcChannel.voterExport, input),
  importOpen: (input) => invoke(IpcChannel.importOpen, input),
  importSelectSheet: (input) => invoke(IpcChannel.importSelectSheet, input),
  importSetEdition: (input) => invoke(IpcChannel.importSetEdition, input),
  importSetMapping: (input) => invoke(IpcChannel.importSetMapping, input),
  importValidate: (input) => invoke(IpcChannel.importValidate, input),
  importListStaged: (input) => invoke(IpcChannel.importListStaged, input),
  importReviewIdentifiers: (input) => invoke(IpcChannel.importReviewIdentifiers, input),
  importAssignStaged: (input) => invoke(IpcChannel.importAssignStaged, input),
  importCommit: (input) => invoke(IpcChannel.importCommit, input),
  importCancel: (input) => invoke(IpcChannel.importCancel, input),
  importTemplate: (input) => invoke(IpcChannel.importTemplate, input),
  importErrorReport: (input) => invoke(IpcChannel.importErrorReport, input),
  onImportProgress: (handler) => {
    const listener = (_event: unknown, progress: { phase: string; processed: number; total: number; message: string }) => {
      handler(progress);
    };
    ipcRenderer.on("winwin:import-progress", listener);
    return () => {
      ipcRenderer.removeListener("winwin:import-progress", listener);
    };
  },
  duplicateList: (input) => invoke(IpcChannel.duplicateList, input),
  duplicateReview: (input) => invoke(IpcChannel.duplicateReview, input),
  reservationOpen: (input) => invoke(IpcChannel.reservationOpen, input),
  reservationSelectSheet: (input) => invoke(IpcChannel.reservationSelectSheet, input),
  reservationSetContext: (input) => invoke(IpcChannel.reservationSetContext, input),
  reservationApproveMandal: (input) => invoke(IpcChannel.reservationApproveMandal, input),
  reservationGeoPlan: (input) => invoke(IpcChannel.reservationGeoPlan, input),
  reservationCreateGeo: (input) => invoke(IpcChannel.reservationCreateGeo, input),
  reservationSetPartial: (input) => invoke(IpcChannel.reservationSetPartial, input),
  reservationCommit: (input) => invoke(IpcChannel.reservationCommit, input),
  reservationCancel: (input) => invoke(IpcChannel.reservationCancel, input),
  reservationSession: (input) => invoke(IpcChannel.reservationSession, input),
  reservationProposals: (input) => invoke(IpcChannel.reservationProposals, input),
  reservationNotificationList: (input) => invoke(IpcChannel.reservationNotificationList, input),
  reservationNotificationCreate: (input) => invoke(IpcChannel.reservationNotificationCreate, input),
  reservationVerify: (input) => invoke(IpcChannel.reservationVerify, input),
  reservationSupersede: (input) => invoke(IpcChannel.reservationSupersede, input),
  reservationList: (input) => invoke(IpcChannel.reservationList, input),
  reservationSummary: (input) => invoke(IpcChannel.reservationSummary, input),
  reservationMatrix: (input) => invoke(IpcChannel.reservationMatrix, input),
  reservationExport: (input) => invoke(IpcChannel.reservationExport, input),
  reservationHistory: (input) => invoke(IpcChannel.reservationHistory, input),
  reservationForUnit: (input) => invoke(IpcChannel.reservationForUnit, input)
};

contextBridge.exposeInMainWorld("winwin", api);
