import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ScopeSelect } from "./ScopeSelect";
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
import { AreaDashboardPage } from "./pages/AreaDashboardPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ElectionsPage } from "./pages/ElectionsPage";
import { RuralPage } from "./pages/RuralPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UrbanPage } from "./pages/UrbanPage";
import { ImportPage } from "./pages/ImportPage";
import { VotersPage } from "./pages/VotersPage";
import { WardWorkspacePage } from "./pages/WardWorkspacePage";
import { WardsPage } from "./pages/WardsPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { OrgPostsPage } from "./pages/OrgPostsPage";

function navClass({ isActive }: { isActive: boolean }): string {
  return `nav-link${isActive ? " active" : ""}`;
}

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
  const location = useLocation();
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

  useEffect(() => {
    document.querySelector(".nav-link.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [location.pathname]);

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
        <nav aria-label="Main">
          <NavLink end data-testid="nav-dashboard" className={navClass} to="/">
            {t(locale, "dashboard")}
          </NavLink>
          <NavLink data-testid="nav-elections" className={navClass} to="/elections">
            {t(locale, "elections")}
          </NavLink>
          <NavLink data-testid="nav-rural" className={navClass} to="/rural">
            {t(locale, "rural")}
          </NavLink>
          <NavLink data-testid="nav-urban" className={navClass} to="/urban">
            {t(locale, "urban")}
          </NavLink>
          <NavLink data-testid="nav-wards" className={navClass} to="/wards">
            {t(locale, "allWards")}
          </NavLink>
          <NavLink end data-testid="nav-voters" className={navClass} to="/voters">
            Voters
          </NavLink>
          <NavLink end data-testid="nav-import" className={navClass} to="/import">
            Import
          </NavLink>
          <NavLink end data-testid="nav-coverage" className={navClass} to="/coverage">
            Coverage
          </NavLink>
          <NavLink data-testid="nav-reservations" className={navClass} to="/reservations">
            Seat Reservations
          </NavLink>
          <NavLink data-testid="nav-org-posts" className={navClass} to="/org-posts">
            Organization Posts
          </NavLink>
          <NavLink end data-testid="nav-backup" className={navClass} to="/backup">
            {t(locale, "backup")}
          </NavLink>
          <NavLink end data-testid="nav-settings" className={navClass} to="/settings">
            {t(locale, "settings")}
          </NavLink>
        </nav>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <ScopeSelect
            id="topbar-constituency"
            label={t(locale, "constituency")}
            value={constituencyId}
            emptyLabel="Select…"
            options={constituencies}
            onChange={setConstituencyId}
          />
          <ScopeSelect
            id="topbar-boundary"
            label={t(locale, "boundaryVersion")}
            value={boundaryVersionId}
            emptyLabel="Select…"
            options={boundaries}
            onChange={setBoundaryVersionId}
          />
          <button className="btn secondary" type="button" onClick={() => navigate("/settings")}>
            Constituencies
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
          <Route path="/areas/mandals/:id" element={<AreaDashboardPage model={model} level="mandal" />} />
          <Route path="/areas/gps/:id" element={<AreaDashboardPage model={model} level="gram_panchayat" />} />
          <Route path="/areas/ulbs/:id" element={<AreaDashboardPage model={model} level="urban_local_body" />} />
          <Route path="/elections" element={<ElectionsPage model={model} />} />
          <Route path="/rural/*" element={<RuralPage model={model} />} />
          <Route path="/urban/*" element={<UrbanPage model={model} />} />
          <Route path="/wards" element={<WardsPage model={model} />} />
          <Route path="/wards/:id/*" element={<WardWorkspacePage model={model} />} />
          <Route path="/voters" element={<VotersPage model={model} />} />
          <Route path="/import" element={<ImportPage model={model} />} />
          <Route path="/coverage" element={<CoveragePage model={model} />} />
          <Route path="/reservations/*" element={<ReservationsPage model={model} />} />
          <Route path="/org-posts/*" element={<OrgPostsPage model={model} />} />
          <Route path="/backup" element={<BackupPage model={model} />} />
          <Route path="/settings" element={<SettingsPage model={model} />} />
        </Routes>
      </main>
    </div>
  );
}
