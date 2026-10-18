import { useState } from "react";
import type { AppModel } from "../App";

export function BackupPage({ model }: { model: AppModel }): JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function backup(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await model.api.backupCreate();
      setMessage(`Backup saved (${result.bytes} bytes). Manual transfer only — not live sync.\n${result.path}`);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function restore(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await model.api.backupRestore();
      await model.refresh();
      setMessage(
        `Restore complete. Recovery copy: ${result.recoveryCopyPath ?? "none"}. Recovered from failure: ${String(result.recoveredFromFailure)}`
      );
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <h1>Backup and restore</h1>
      <article className="card grid">
        <p>
          Backups use a portable <code>.winwinbak</code> file. Copy the file to another computer if needed. This is not
          live synchronization. The database and backups are not encrypted.
        </p>
        <p>The active database file cannot be chosen as a backup destination.</p>
        <div className="row">
          <button className="btn" id="backup-create" data-testid="backup-create" disabled={busy} type="button" onClick={() => void backup()}>
            Create backup
          </button>
          <button className="btn danger" id="backup-restore" data-testid="backup-restore" disabled={busy} type="button" onClick={() => void restore()}>
            Restore from file
          </button>
        </div>
        {message ? <pre data-testid="backup-message">{message}</pre> : null}
      </article>
    </section>
  );
}
