import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { t } from "@shared/i18n";
import type {
  AppInfo,
  AppSettings,
  AssemblyConstituency,
  BoundaryVersion,
  Locale
} from "@shared/types";
import { BackupPage } from "./pages/BackupPage";
import { CoveragePage } from "./pages/CoveragePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ElectionsPage } from "./pages/ElectionsPage";
import { RuralPage } from "./pages/RuralPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UrbanPage } from "./pages/UrbanPage";
import { ImportPage } from "./pages/ImportPage";
import { VotersPage } from "./pages/VotersPage";
import { WardWorkspacePage } from "./pages/WardWorkspacePage";
import { WardsPage } from "./pages/WardsPage";

export interface AppModel {
  api: typeof window.winwin;
  info: AppInfo | null;
  settings: AppSettings | null;
  constituencies: AssemblyConstituency[];
  boundaries: BoundaryVersion[];
  constituencyId: string;
  boundaryVersionId: string;
  locale: Locale;
  error: string | null;
  setError: (value: string | null) => void;
  refresh: () => Promise<void>;
  setConstituencyId: (id: string) => void;
  setBoundaryVersionId: (id: string) => void;
}

export function App(): JSX.Element {
  const api = window.winwin;
  const navigate = useNavigate();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [constituencies, setConstituencies] = useState<AssemblyConstituency[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryVersion[]>([]);
  const [constituencyId, setConstituencyId] = useState("");
  const [boundaryVersionId, setBoundaryVersionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!api) {
      throw new Error("WIN WIN preload API is unavailable. Check that contextIsolation and the preload script are enabled.");
    }
    const [nextInfo, nextSettings, nextConstituencies, nextBoundaries] = await Promise.all([
      api.appInfo(),
      api.settingsGet(),
      api.constituencyList(false),
      api.boundaryList()
    ]);
    setInfo(nextInfo);
    setSettings(nextSettings);
    setConstituencies(nextConstituencies);
    setBoundaries(nextBoundaries);
    setConstituencyId((current) => {
      if (current && nextConstituencies.some((c) => c.id === current)) return current;
      return nextSettings.defaultConstituencyId || nextConstituencies[0]?.id || "";
    });
    setBoundaryVersionId((current) => {
      if (current && nextBoundaries.some((b) => b.id === current)) return current;
      const active = nextBoundaries.find((b) => b.status === "active") ?? nextBoundaries[0];
      return active?.id || "";
    });
    setReady(true);
  }, [api]);

  useEffect(() => {
    refresh().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [refresh]);

  const locale = settings?.locale ?? "en";
  const model: AppModel = useMemo(
    () => ({
      api,
      info,
      settings,
      constituencies,
      boundaries,
      constituencyId,
      boundaryVersionId,
      locale,
      error,
      setError,
      refresh,
      setConstituencyId,
      setBoundaryVersionId
    }),
    [
      api,
      info,
      settings,
      constituencies,
      boundaries,
      constituencyId,
      boundaryVersionId,
      locale,
      error,
      refresh
    ]
  );

  if (!ready && !error) return <div className="workspace">Loading WIN WIN…</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          WIN <span>WIN</span>
        </div>
        <nav>
          <NavLink data-testid="nav-dashboard" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/">
            {t(locale, "dashboard")}
          </NavLink>
          <NavLink data-testid="nav-elections" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/elections">
            {t(locale, "elections")}
          </NavLink>
          <NavLink data-testid="nav-rural" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/rural">
            {t(locale, "rural")}
          </NavLink>
          <NavLink data-testid="nav-urban" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/urban">
            {t(locale, "urban")}
          </NavLink>
          <NavLink data-testid="nav-wards" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/wards">
            {t(locale, "allWards")}
          </NavLink>
          <NavLink data-testid="nav-voters" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/voters">
            Voters
          </NavLink>
          <NavLink data-testid="nav-import" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/import">
            Import
          </NavLink>
          <NavLink data-testid="nav-coverage" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/coverage">
            Coverage
          </NavLink>
          <NavLink data-testid="nav-backup" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/backup">
            {t(locale, "backup")}
          </NavLink>
          <NavLink data-testid="nav-settings" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/settings">
            {t(locale, "settings")}
          </NavLink>
        </nav>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <label>
            {t(locale, "constituency")}
            <select id="topbar-constituency" data-testid="topbar-constituency" value={constituencyId} onChange={(e) => setConstituencyId(e.target.value)}>
              <option value="">Select…</option>
              {constituencies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.nameTe ? `/ ${item.nameTe}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "boundaryVersion")}
            <select id="topbar-boundary" data-testid="topbar-boundary" value={boundaryVersionId} onChange={(e) => setBoundaryVersionId(e.target.value)}>
              <option value="">Select…</option>
              {boundaries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn secondary" type="button" onClick={() => navigate("/settings")}>
            New constituency
          </button>
        </div>
        {settings?.dataKind === "demo" ? <div className="banner">{t(locale, "demoBanner")}</div> : null}
        {error ? (
          <div className="error" data-testid="app-error" role="alert">
            {error}
          </div>
        ) : null}
        <Routes>
          <Route path="/" element={<DashboardPage model={model} />} />
          <Route path="/elections" element={<ElectionsPage model={model} />} />
          <Route path="/rural/*" element={<RuralPage model={model} />} />
          <Route path="/urban/*" element={<UrbanPage model={model} />} />
          <Route path="/wards" element={<WardsPage model={model} />} />
          <Route path="/wards/:id/*" element={<WardWorkspacePage model={model} />} />
          <Route path="/voters" element={<VotersPage model={model} />} />
          <Route path="/import" element={<ImportPage model={model} />} />
          <Route path="/coverage" element={<CoveragePage model={model} />} />
          <Route path="/backup" element={<BackupPage model={model} />} />
          <Route path="/settings" element={<SettingsPage model={model} />} />
        </Routes>
      </main>
    </div>
  );
}
