import { FormEvent, useEffect, useState } from "react";
import { t } from "@shared/i18n";
import type { AppModel } from "../App";

export function SettingsPage({ model }: { model: AppModel }): JSX.Element {
  const [org, setOrg] = useState(model.settings?.organizationName ?? "");
  const [locale, setLocale] = useState(model.settings?.locale ?? "en");
  const [defaultId, setDefaultId] = useState(model.settings?.defaultConstituencyId ?? "");
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof model.api.auditList>> | null>(null);
  const [cName, setCName] = useState("");
  const [cNameTe, setCNameTe] = useState("");
  const [bName, setBName] = useState("");
  const [bFrom, setBFrom] = useState(new Date().toISOString().slice(0, 10));
  const [demo, setDemo] = useState<{ dataKind: string; canLoadDemo: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrg(model.settings?.organizationName ?? "");
    setLocale(model.settings?.locale ?? "en");
    setDefaultId(model.settings?.defaultConstituencyId ?? "");
  }, [model.settings]);

  useEffect(() => {
    model.api.auditList({ page: 1, pageSize: 20 }).then(setAudit).catch(() => undefined);
    model.api.demoStatus().then(setDemo).catch(() => undefined);
  }, [model.api, model.constituencies.length]);

  async function saveSettings(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await model.api.settingsUpdate({
        organizationName: org,
        locale,
        defaultConstituencyId: defaultId || null
      });
      await model.refresh();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createConstituency(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await model.api.constituencyCreate({ name: cName, nameTe: cNameTe });
      setCName("");
      setCNameTe("");
      await model.refresh();
      model.setConstituencyId(created.id);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createBoundary(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await model.api.boundaryCreate({ name: bName, effectiveFrom: bFrom, status: "active" });
      setBName("");
      await model.refresh();
      model.setBoundaryVersionId(created.id);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <h1>{t(model.locale, "settings")}</h1>
      <form className="card grid" onSubmit={saveSettings}>
        <label>
          Organization name
          <input value={org} onChange={(e) => setOrg(e.target.value)} />
        </label>
        <label>
          Default constituency
          <select value={defaultId} onChange={(e) => setDefaultId(e.target.value)}>
            <option value="">None</option>
            {model.constituencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Interface language
          <select value={locale} onChange={(e) => setLocale(e.target.value as "en" | "te")}>
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
          </select>
        </label>
        <button className="btn" disabled={busy} type="submit">
          Save settings
        </button>
      </form>

      <article className="card grid">
        <h2>Application data</h2>
        <p>Version {model.info?.version} · schema {model.info?.schemaVersion}</p>
        <p>Data location: {model.info?.dataDirectory}</p>
        <p>Database: {model.info?.databasePath}</p>
        <p>{t(model.locale, "notEncrypted")}</p>
      </article>

      <form className="card grid" onSubmit={createConstituency}>
        <h2>Create assembly constituency</h2>
        <label>
          Name
          <input required value={cName} onChange={(e) => setCName(e.target.value)} />
        </label>
        <label>
          Telugu name
          <input value={cNameTe} onChange={(e) => setCNameTe(e.target.value)} />
        </label>
        <button className="btn" disabled={busy} type="submit">
          Create constituency
        </button>
      </form>

      <form className="card grid" onSubmit={createBoundary}>
        <h2>Create boundary version</h2>
        <label>
          Name
          <input required value={bName} onChange={(e) => setBName(e.target.value)} />
        </label>
        <label>
          Effective from
          <input type="date" required value={bFrom} onChange={(e) => setBFrom(e.target.value)} />
        </label>
        <button className="btn" disabled={busy} type="submit">
          Create boundary version
        </button>
        <ul>
          {model.boundaries.map((b) => (
            <li key={b.id}>
              {b.name} ({b.status}) {b.effectiveFrom}
            </li>
          ))}
        </ul>
      </form>

      <article className="card grid">
        <h2>Demonstration data</h2>
        <p>Optional labelled [DEMO] records. Refused if this workspace already has operational data.</p>
        <button
          className="btn secondary"
          disabled={!demo?.canLoadDemo || busy}
          type="button"
          onClick={async () => {
            if (!window.confirm("Load labelled demonstration records into this empty workspace?")) return;
            setBusy(true);
            try {
              await model.api.demoLoad();
              await model.refresh();
            } catch (err) {
              model.setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Load demonstration data
        </button>
      </article>

      <article className="card">
        <h2>Audit history</h2>
        <p>Field names only. Personal values are not copied into logs.</p>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Record</th>
              <th>Fields</th>
            </tr>
          </thead>
          <tbody>
            {audit?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.createdAt}</td>
                <td>{row.action}</td>
                <td>{row.entityType}</td>
                <td>{row.recordId}</td>
                <td>{row.changedFields.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit && audit.total === 0 ? <p className="empty">No audit events yet.</p> : null}
      </article>
    </section>
  );
}
