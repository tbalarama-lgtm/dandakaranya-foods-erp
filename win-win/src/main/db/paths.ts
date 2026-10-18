import fs from "node:fs";
import path from "node:path";

export interface DataPaths {
  dataDir: string;
  databasePath: string;
  backupsDir: string;
  recoveryDir: string;
}

export function resolveDataPaths(userDataDir: string): DataPaths {
  const dataDir = path.join(userDataDir, "win-win-data");
  return {
    dataDir,
    databasePath: path.join(dataDir, "win-win.sqlite"),
    backupsDir: path.join(dataDir, "backups"),
    recoveryDir: path.join(dataDir, "recovery")
  };
}

export function ensureDataDirectories(paths: DataPaths): void {
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  fs.mkdirSync(paths.recoveryDir, { recursive: true });
}

export function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}
