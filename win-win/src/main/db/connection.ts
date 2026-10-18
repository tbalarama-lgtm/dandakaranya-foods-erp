import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_VERSION } from "@shared/constants";
import { AppError } from "../errors";
import { applyMigrations } from "./schema";
import { ensureDataDirectories, type DataPaths } from "./paths";

export class DatabaseManager {
  private db: Database.Database | null = null;

  constructor(readonly paths: DataPaths) {}

  open(): Database.Database {
    if (this.db) return this.db;
    ensureDataDirectories(this.paths);
    const backupDir = this.paths.backupsDir;
    const pendingDb = this.paths.databasePath;
    const existed = fs.existsSync(pendingDb);
    this.db = this.connect(pendingDb, { fileMustExist: false });
    this.enablePragmas(this.db);
    try {
      if (existed) {
        const current = Number(
          (
            this.db
              .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
              .get() as { value?: string } | undefined
          )?.value ?? "0"
        );
        if (current < SCHEMA_VERSION) {
          const migrateBackup = path.join(
            backupDir,
            `pre-migrate-v${current}-to-v${SCHEMA_VERSION}-${timestampFile()}.sqlite`
          );
          this.db.close();
          this.db = null;
          this.backupFile(pendingDb, migrateBackup);
          this.db = this.connect(pendingDb, { fileMustExist: true });
          this.enablePragmas(this.db);
        }
      }
      applyMigrations(this.db);
      this.db.prepare("UPDATE app_meta SET value = ? WHERE key = 'schema_version'").run(String(SCHEMA_VERSION));
    } catch (error) {
      this.close();
      throw new AppError(
        "database_open_failed",
        `Could not initialize the local database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return this.db;
  }

  get(): Database.Database {
    if (!this.db) return this.open();
    this.db.pragma("foreign_keys = ON");
    return this.db;
  }

  close(): void {
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }

  reopen(): Database.Database {
    this.close();
    return this.open();
  }

  connect(filePath: string, options: { fileMustExist: boolean }): Database.Database {
    const db = new Database(filePath, {
      fileMustExist: options.fileMustExist,
      timeout: 5000
    });
    this.enablePragmas(db);
    return db;
  }

  private enablePragmas(db: Database.Database): void {
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    db.pragma("journal_mode = WAL");
    const fk = db.pragma("foreign_keys", { simple: true });
    if (Number(fk) !== 1) {
      throw new AppError("foreign_keys_disabled", "Foreign keys could not be enabled on the SQLite connection.");
    }
  }

  private backupFile(source: string, dest: string): void {
    fs.copyFileSync(source, dest);
    for (const suffix of ["-wal", "-shm"]) {
      const extra = source + suffix;
      if (fs.existsSync(extra)) fs.copyFileSync(extra, dest + suffix);
    }
  }
}

function timestampFile(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export function openMemory(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  applyMigrations(db);
  return db;
}
