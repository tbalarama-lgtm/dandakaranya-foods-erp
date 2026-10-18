import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  APP_ID,
  BACKUP_FORMAT_VERSION,
  BACKUP_MAGIC,
  MIN_COMPATIBLE_SCHEMA,
  SCHEMA_VERSION
} from "@shared/constants";
import { createManifest, type BackupManifest } from "@shared/backup-format";
import type { BackupResult, RestoreResult } from "@shared/types";
import { AppError } from "../errors";
import { applyMigrations } from "../db/schema";
import { samePath, type DataPaths } from "../db/paths";
import type { DatabaseManager } from "../db/connection";

export interface BackupDialogs {
  saveFile(defaultName: string): Promise<string | null>;
  openFile(): Promise<string | null>;
  confirm(message: string): Promise<boolean>;
}

function platformName(): BackupManifest["createdOnPlatform"] {
  if (process.platform === "win32" || process.platform === "darwin" || process.platform === "linux") {
    return process.platform;
  }
  return "unknown";
}

export function encodeBackup(manifest: BackupManifest, sqliteBytes: Buffer): Buffer {
  const manifestBuffer = Buffer.from(JSON.stringify(manifest), "utf8");
  const header = Buffer.alloc(12);
  header.write(BACKUP_MAGIC, 0, 8, "ascii");
  header.writeUInt32BE(manifestBuffer.length, 8);
  return Buffer.concat([header, manifestBuffer, sqliteBytes]);
}

export function decodeBackup(bytes: Buffer): { manifest: BackupManifest; sqliteBytes: Buffer } {
  if (bytes.length < 12) throw new AppError("invalid_backup", "The selected file is not a WIN WIN backup.");
  const magic = bytes.subarray(0, 8).toString("ascii");
  if (magic !== BACKUP_MAGIC) throw new AppError("invalid_backup", "The selected file is not a WIN WIN backup.");
  const manifestLength = bytes.readUInt32BE(8);
  const manifestEnd = 12 + manifestLength;
  if (manifestLength < 2 || manifestEnd > bytes.length) {
    throw new AppError("invalid_backup", "The backup file header is damaged.");
  }
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(bytes.subarray(12, manifestEnd).toString("utf8")) as BackupManifest;
  } catch {
    throw new AppError("invalid_backup", "The backup manifest is not valid JSON.");
  }
  return { manifest, sqliteBytes: bytes.subarray(manifestEnd) };
}

export async function sqliteBackupToBuffer(sourcePath: string): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `winwin-bak-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  const source = new Database(sourcePath, { fileMustExist: true, readonly: false });
  try {
    source.pragma("foreign_keys = ON");
    await source.backup(tmp);
  } finally {
    source.close();
  }
  try {
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
    fs.rmSync(tmp + "-wal", { force: true });
    fs.rmSync(tmp + "-shm", { force: true });
  }
}

export function validateSqlitePayload(sqliteBytes: Buffer): { schemaVersion: number } {
  const tmp = path.join(os.tmpdir(), `winwin-chk-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  fs.writeFileSync(tmp, sqliteBytes);
  let db: Database.Database | null = null;
  try {
    db = new Database(tmp, { fileMustExist: true });
    db.pragma("foreign_keys = ON");
    const integrity = String(db.pragma("integrity_check", { simple: true }));
    if (integrity !== "ok") {
      throw new AppError("invalid_backup", `Database integrity check failed (${integrity}).`);
    }
    const appId = (db.prepare("SELECT value FROM app_meta WHERE key = 'app_id'").get() as { value: string } | undefined)?.value;
    if (appId !== APP_ID) {
      throw new AppError("incompatible_backup", "This file is not a WIN WIN application database.");
    }
    const schemaVersion = Number(
      (db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value ?? "0"
    );
    if (!Number.isFinite(schemaVersion) || schemaVersion < MIN_COMPATIBLE_SCHEMA || schemaVersion > SCHEMA_VERSION) {
      throw new AppError(
        "incompatible_backup",
        `Backup schema version ${schemaVersion} is not compatible with this application (supports ${MIN_COMPATIBLE_SCHEMA}–${SCHEMA_VERSION}).`
      );
    }
    return { schemaVersion };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("invalid_backup", "The backup SQLite payload could not be opened.");
  } finally {
    db?.close();
    fs.rmSync(tmp, { force: true });
    fs.rmSync(tmp + "-wal", { force: true });
    fs.rmSync(tmp + "-shm", { force: true });
  }
}

export function validateManifest(manifest: BackupManifest): void {
  if (manifest.magic !== BACKUP_MAGIC) throw new AppError("invalid_backup", "Backup magic value is incorrect.");
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new AppError("incompatible_backup", `Unsupported backup format version ${manifest.formatVersion}.`);
  }
  if (manifest.appId !== APP_ID) {
    throw new AppError("incompatible_backup", "This backup belongs to a different application.");
  }
  if (manifest.schemaVersion < MIN_COMPATIBLE_SCHEMA || manifest.schemaVersion > SCHEMA_VERSION) {
    throw new AppError("incompatible_backup", "Backup schema version is not compatible.");
  }
}

function recoveryName(): string {
  return `win-win.pre-restore.${new Date().toISOString().replaceAll(":", "-")}.sqlite`;
}

export async function createBackup(manager: DatabaseManager, destPath: string): Promise<BackupResult> {
  const active = manager.paths.databasePath;
  if (samePath(destPath, active)) {
    throw new AppError("invalid_backup_destination", "Never overwrite the active database as a backup destination.");
  }
  const extOk = destPath.endsWith(".winwinbak");
  const output = extOk ? destPath : `${destPath}.winwinbak`;
  if (samePath(output, active)) {
    throw new AppError("invalid_backup_destination", "Never overwrite the active database as a backup destination.");
  }
  manager.get();
  const sqliteBytes = await sqliteBackupToBuffer(active);
  const manifest = createManifest({
    appId: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    createdOnPlatform: platformName()
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, encodeBackup(manifest, sqliteBytes));
  const stat = fs.statSync(output);
  return { path: output, createdAt: manifest.createdAt, bytes: stat.size };
}

export async function restoreBackup(
  manager: DatabaseManager,
  sourcePath: string,
  options?: { skipConfirm?: boolean; dialogs?: BackupDialogs; simulateReplaceFailure?: boolean }
): Promise<RestoreResult> {
  const bytes = fs.readFileSync(sourcePath);
  const { manifest, sqliteBytes } = decodeBackup(bytes);
  validateManifest(manifest);
  validateSqlitePayload(sqliteBytes);

  const confirmed =
    options?.skipConfirm || (await options?.dialogs?.confirm(
      "Replace the current WIN WIN database with this backup? A recovery copy of the current data will be kept. This is a manual restore, not live synchronization."
    ));
  if (!confirmed) throw new AppError("restore_cancelled", "Restore cancelled.");

  const recoveryPath = path.join(manager.paths.recoveryDir, recoveryName());
  fs.mkdirSync(manager.paths.recoveryDir, { recursive: true });
  if (fs.existsSync(manager.paths.databasePath)) {
    const liveBytes = await sqliteBackupToBuffer(manager.paths.databasePath);
    fs.writeFileSync(recoveryPath, liveBytes);
  }

  manager.close();
  const target = manager.paths.databasePath;
  const wal = target + "-wal";
  const shm = target + "-shm";
  try {
    if (options?.simulateReplaceFailure) {
      throw new Error("simulated replace failure");
    }
    fs.writeFileSync(target, sqliteBytes);
    fs.rmSync(wal, { force: true });
    fs.rmSync(shm, { force: true });
    const reopened = manager.reopen();
    applyMigrations(reopened);
    return { ok: true, recoveredFromFailure: false, recoveryCopyPath: fs.existsSync(recoveryPath) ? recoveryPath : null };
  } catch (error) {
    try {
      if (fs.existsSync(recoveryPath)) {
        fs.copyFileSync(recoveryPath, target);
        fs.rmSync(wal, { force: true });
        fs.rmSync(shm, { force: true });
      }
      manager.reopen();
    } catch {
      /* still report original failure after attempted recovery */
    }
    if (error instanceof AppError) throw error;
    throw new AppError(
      "restore_failed",
      `Restore failed and the previous database was reinstated from the recovery copy. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function createBackupWithDialog(manager: DatabaseManager, dialogs: BackupDialogs): Promise<BackupResult> {
  const defaultName = `WIN-WIN-backup-${new Date().toISOString().slice(0, 10)}.winwinbak`;
  const dest = await dialogs.saveFile(defaultName);
  if (!dest) throw new AppError("backup_cancelled", "Backup cancelled.");
  return createBackup(manager, dest);
}

export async function restoreBackupWithDialog(manager: DatabaseManager, dialogs: BackupDialogs): Promise<RestoreResult> {
  const source = await dialogs.openFile();
  if (!source) throw new AppError("restore_cancelled", "Restore cancelled.");
  return restoreBackup(manager, source, { dialogs });
}
