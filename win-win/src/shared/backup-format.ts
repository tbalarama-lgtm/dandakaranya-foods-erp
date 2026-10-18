import { BACKUP_FORMAT_VERSION, BACKUP_MAGIC } from "./constants";

export interface BackupManifest {
  magic: typeof BACKUP_MAGIC;
  formatVersion: number;
  appId: string;
  schemaVersion: number;
  createdAt: string;
  createdOnPlatform: "win32" | "darwin" | "linux" | "unknown";
  transferNote: string;
  unicode: "utf-8";
}

export const TRANSFER_NOTE =
  "Manual file transfer only. This is not live cross-device synchronization. Restore on the destination computer after copying this file.";

export function createManifest(input: {
  appId: string;
  schemaVersion: number;
  createdOnPlatform: BackupManifest["createdOnPlatform"];
}): BackupManifest {
  return {
    magic: BACKUP_MAGIC,
    formatVersion: BACKUP_FORMAT_VERSION,
    appId: input.appId,
    schemaVersion: input.schemaVersion,
    createdAt: new Date().toISOString(),
    createdOnPlatform: input.createdOnPlatform,
    transferNote: TRANSFER_NOTE,
    unicode: "utf-8"
  };
}
