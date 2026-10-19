import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  ElectionWorkspace,
  GeoDashboard,
  GeoDashboardLevel,
  GeoDirectory,
  ReservationNotification,
  RollEdition
} from "@shared/types";
import type { AppModel } from "../App";
import { StatusBadge, issueTone, taskTone } from "../StatusBadge";

function stamp(value: string): string {
  return value.replace("T", " ").slice(0, 16);
}

const LEGACY_STAT: Record<string, string> = {
  mandals: "stat-value-mandals",
  gps: "stat-value-gram-panchayats",
  villages: "stat-value-villages",
  ulbs: "stat-value-urban-local-bodies",
  ruralWards: "stat-value-rural-wards",
  urbanWards: "stat-value-urban-wards",
  electionWorkspaces: "stat-value-election-workspaces"
};

function keepContext(search: URLSearchParams, extra?: Record<string, string | undefined>): string {
  const next = new URLSearchParams();
  for (const key of ["election", "edition", "notification"]) {
    const value = extra?.[key] ?? search.get(key);
    if (value) next.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key === "election" || key === "edition" || key === "notification") continue;
      if (value) next.set(key, value);
    }
  }
  const text = next.toString();
  return text ? `?${text}` : "";
}

export function GeoDashboardView({
  model,
  level,
  unitId,
  embedded
}: {
  model: AppModel;
  level: GeoDashboardLevel;
  unitId?: string;
  embedded?: boolean;
}): JSX.Element {
  const [params, setParams] = useSearchParams();
  const electionId = params.get("election") ?? "";
  const editionId = params.get("edition") ?? "";
  const notificationId = params.get("notification") ?? "";
  const section = params.get("section") ?? "";
  const [data, setData] = useState<GeoDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [elections, setElections] = useState<ElectionWorkspace[]>([]);
  const [editions, setEditions] = useState<RollEdition[]>([]);
  const [notes, setNotes] = useState<ReservationNotification[]>([]);
  const [queries, setQueries] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!model.constituencyId) return;
    model.api.electionList({ constituencyId: model.constituencyId }).then(setElections).catch(() => undefined);
    model.api.editionList({ constituencyId: model.constituencyId }).then(setEditions).catch(() => undefined);
  }, [model.api, model.constituencyId]);

  useEffect(() => {
    if (!model.constituencyId) return;
    model.api
      .reservationNotificationList({ constituencyId: model.constituencyId, electionId: electionId || undefined })
      .then(setNotes)
      .catch(() => undefined);
  }, [model.api, model.constituencyId, electionId]);

  useEffect(() => {
    if (!model.constituencyId || !model.boundaryVersionId) {
      setData(null);
      return;
    }
    if (level !== "assembly" && !unitId) return;
    setLoading(true);
    model.api
      .geoDashboard({
        constituencyId: model.constituencyId,
        boundaryVersionId: model.boundaryVersionId,
        level,
        unitId,
        electionId: electionId || undefined,
        rollEditionId: editionId || undefined,
        notificationId: notificationId || undefined
      })
      .then((next) => {
        setData(next);
        model.setError(null);
      })
      .catch((err: unknown) => {
        setData(null);
        model.setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [
    model.api,
    model.constituencyId,
    model.boundaryVersionId,
    level,
    unitId,
    electionId,
    editionId,
    notificationId
  ]);

  useEffect(() => {
    if (!section) return;
    const node = document.getElementById(`geo-section-${section}`);
    node?.scrollIntoView({ block: "start" });
  }, [section, data]);

  function setFilter(key: string, value: string): void {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "election") next.delete("notification");
    setParams(next, { replace: true });
  }

  const filteredDirectories = useMemo(() => {
    if (!data) return [];
    return data.directories.map((directory) => {
      const query = (queries[directory.key] ?? "").trim().toLowerCase();
      if (!query) return directory;
      return {
        ...directory,
        rows: directory.rows.filter(
          (row) =>
            row.name.toLowerCase().includes(query) ||
            row.nameTe.toLowerCase().includes(query) ||
            (row.subtitle ?? "").toLowerCase().includes(query)
        )
      };
    });
  }, [data, queries]);

  if (!model.constituencyId) {
    return (
      <article className="card empty">
        <h2>Select a constituency</h2>
        <p>Geographic dashboards use the selected assembly constituency and boundary version.</p>
        <Link className="btn" to="/settings">
          Open Settings
        </Link>
      </article>
    );
  }

  return (
    <section className="grid" data-testid={`geo-dashboard-${level}`}>
      {!embedded ? (
        <header className="ward-head">
          <p className="breadcrumb" data-testid="geo-breadcrumb">
            {data?.breadcrumb.map((crumb, index) => (
              <span key={`${crumb.href}-${index}`}>
                {index ? " → " : null}
                <Link to={crumb.href}>{crumb.label}</Link>
              </span>
            ))}
          </p>
          <div className="context-strip">
            <h1>
              {data?.name ?? "Dashboard"}
              {data?.nameTe ? ` · ${data.nameTe}` : ""}
            </h1>
            {data ? <StatusBadge tone="neutral">{data.classification}</StatusBadge> : null}
          </div>
        </header>
      ) : null}
      <div className="row">
        <label>
          Election workspace
          <select data-testid="geo-election" value={electionId} onChange={(e) => setFilter("election", e.target.value)}>
            <option value="">None selected</option>
            {elections.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.year})
              </option>
            ))}
          </select>
        </label>
        <label>
          Roll edition
          <select data-testid="geo-edition" value={editionId} onChange={(e) => setFilter("edition", e.target.value)}>
            <option value="">Select one edition…</option>
            {editions.filter((row) => !row.archived).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reservation notification
          <select
            data-testid="geo-notification"
            value={notificationId}
            onChange={(e) => setFilter("notification", e.target.value)}
          >
            <option value="">Default for election</option>
            {notes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.status}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data ? (
        <p className="lede" data-testid="geo-context">
          Boundary {data.boundaryName}
          {data.electionName ? ` · Election ${data.electionName}` : " · No election selected"}
          {data.rollEditionName ? ` · Voter counts use ${data.rollEditionName}` : " · Voter counts wait for a roll edition"}
          {data.parentName ? ` · Parent ${data.parentName}` : ""}
          {data.administrativeMandalName ? ` · Administrative mandal ${data.administrativeMandalName} (optional, not a navigation level)` : ""}
        </p>
      ) : null}
      {data?.rollEditionHint ? <p className="banner">{data.rollEditionHint}</p> : null}
      {loading ? <p className="empty">Loading dashboard…</p> : null}
      {data ? (
        <>
          <div className="grid stats">
            {data.metrics.map((item) => (
              <Link
                key={item.key}
                className="card stat raised geo-metric"
                to={item.href || "."}
                data-testid={`geo-metric-${item.key}`}
                title={item.hint}
              >
                <span>{item.label}</span>
                <b data-testid={LEGACY_STAT[item.key]}>{item.missing ? "—" : item.value}</b>
                <small className="history">{item.missing ? "Not selected" : item.hint}</small>
              </Link>
            ))}
          </div>
          {data.reservation ? (
            <article className="card grid" data-testid="geo-reservation">
              <h2>Seat reservations</h2>
              {data.reservation.applicable && !data.reservation.message ? (
                <>
                  {level === "gram_panchayat" || level === "rural_ward" ? (
                    <p>
                      Sarpanch: {data.reservation.sarpanchCode ?? "Not recorded"}{" "}
                      {data.reservation.sarpanchCode ? (
                        <StatusBadge tone={data.reservation.sarpanchWomen ? "info" : "neutral"}>
                          {data.reservation.sarpanchWomen ? "Women-reserved" : "Not specifically reserved for women"}
                        </StatusBadge>
                      ) : null}
                    </p>
                  ) : null}
                  {Object.keys(data.reservation.wardMemberByCode).length ? (
                    <p>
                      Ward Member seats:{" "}
                      {Object.entries(data.reservation.wardMemberByCode)
                        .map(([code, n]) => `${code} ${n}`)
                        .join(" · ")}
                    </p>
                  ) : (
                    <p className="empty">No Ward Member reservation totals in this scope.</p>
                  )}
                  <p className="history">
                    Notification {data.reservation.notificationName}. Sarpanch and Ward Member totals are kept separate.
                  </p>
                </>
              ) : (
                <p className="empty">{data.reservation.message}</p>
              )}
            </article>
          ) : null}
          <article className="card grid" data-testid="geo-org-posts">
            <h2>Organization posts associated with this area</h2>
            <p className="history">
              Only units with an explicit geographic association are counted. Organizational boundaries are not assumed to match this administrative unit.
            </p>
            <p>
              Associated units {data.organizationAssociation.associatedUnits} · Posts{" "}
              {data.organizationAssociation.associatedPosts} · Current office holders{" "}
              {data.organizationAssociation.currentOfficeHolders} · Verified vacancies{" "}
              {data.organizationAssociation.verifiedVacancies} · Status unknown{" "}
              {data.organizationAssociation.unknownStatusPosts}
            </p>
            <Link className="btn secondary" to={data.organizationAssociation.href}>
              Open organization posts
            </Link>
          </article>
          {filteredDirectories.map((directory) => (
            <DirectoryCard
              key={directory.key}
              directory={directory}
              query={queries[directory.key] ?? ""}
              onQuery={(value) => setQueries((curr) => ({ ...curr, [directory.key]: value }))}
            />
          ))}
          {data.villages.length ? (
            <article className="card grid" id="geo-section-villages">
              <h2>Linked villages</h2>
              <ul>
                {data.villages.map((village) => (
                  <li key={village.id}>
                    {village.name} {village.nameTe}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          {data.team.length ? (
            <article className="card grid" data-testid="geo-team">
              <h2>Active team assignments</h2>
              <ul>
                {data.team.map((member) => (
                  <li key={member.id}>
                    <Link to={member.href}>
                      {member.name} · {member.role}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          <div className="grid two-col">
            <article className="card raised grid" id="geo-section-tasks" data-testid="geo-overdue">
              <h2>Overdue tasks</h2>
              {data.overdueTasks.length ? (
                <ul className="work-list">
                  {data.overdueTasks.map((item) => (
                    <li key={item.id}>
                      <Link to={`${item.href}${keepContext(params)}`}>{item.title}</Link>
                      <span className="history">
                        {item.wardName} · due {item.dueDate}{" "}
                        <StatusBadge tone="danger">overdue</StatusBadge>{" "}
                        <StatusBadge tone={taskTone(item.status ?? "open")}>
                          {(item.status ?? "open").replaceAll("_", " ")}
                        </StatusBadge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No overdue tasks in this geographic scope.</p>
              )}
            </article>
            <article className="card raised grid" id="geo-section-issues" data-testid="geo-issues">
              <h2>Unresolved issues</h2>
              {data.unresolvedIssues.length ? (
                <ul className="work-list">
                  {data.unresolvedIssues.map((item) => (
                    <li key={item.id}>
                      <Link to={`${item.href}${keepContext(params)}`}>
                        {item.referenceNumber ? `${item.referenceNumber} ` : ""}
                        {item.title}
                      </Link>
                      <span className="history">
                        {item.wardName}{" "}
                        <StatusBadge tone={issueTone(item.status ?? "open")}>
                          {(item.status ?? "open").replaceAll("_", " ")}
                        </StatusBadge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No unresolved issues in this geographic scope.</p>
              )}
            </article>
          </div>
          <article className="card raised grid" data-testid="geo-review">
            <h2>Data completeness and review</h2>
            {data.reviewItems.length ? (
              <ul className="work-list">
                {data.reviewItems.map((item) => (
                  <li key={item.key}>
                    <Link to={item.href}>
                      {item.label}: {item.count}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No review items for the selected context. Empty implemented modules show zero, not missing.</p>
            )}
          </article>
          <article className="card raised grid" data-testid="geo-activity">
            <h2>Recent activity</h2>
            {data.recentActivity.length ? (
              <ul className="work-list">
                {data.recentActivity.map((item) => (
                  <li key={`${item.kind}-${item.recordId}-${item.at}`}>
                    {item.href ? (
                      <Link to={`${item.href}${keepContext(params)}`}>
                        {item.action ?? item.kind} · {item.record ?? item.summary}
                      </Link>
                    ) : (
                      <span>{item.summary}</span>
                    )}
                    <span className="history">
                      {item.wardName ? `${item.wardName} · ` : ""}
                      {stamp(item.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No workspace activity in this geographic scope yet.</p>
            )}
          </article>
          <div className="row">
            {data.shortcuts.map((item) => (
              <Link key={item.href + item.label} className="btn secondary" to={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </>
      ) : !loading ? (
        <p className="empty">Dashboard data is unavailable for this selection.</p>
      ) : null}
    </section>
  );
}

function DirectoryCard({
  directory,
  query,
  onQuery
}: {
  directory: GeoDirectory;
  query: string;
  onQuery: (value: string) => void;
}): JSX.Element {
  return (
    <article className="card grid" id={`geo-section-${directory.key}`} data-testid={`geo-dir-${directory.key}`}>
      <h2>{directory.title}</h2>
      <div className="search">
        <input
          data-testid={`geo-search-${directory.key}`}
          placeholder={directory.searchPlaceholder}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      {directory.rows.length === 0 ? (
        <p className="empty">No records in this directory for the current coverage.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {directory.columns
                .filter((col) => col.key !== "name")
                .map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {directory.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={row.href} data-testid={`geo-link-${directory.key}-${row.id}`}>
                    {row.name}
                    {row.nameTe ? ` · ${row.nameTe}` : ""}
                  </Link>
                  {row.subtitle ? <div className="history">{row.subtitle}</div> : null}
                </td>
                {directory.columns
                  .filter((col) => col.key !== "name")
                  .map((col) => (
                    <td key={col.key}>{row.values[col.key] == null ? "—" : String(row.values[col.key])}</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
