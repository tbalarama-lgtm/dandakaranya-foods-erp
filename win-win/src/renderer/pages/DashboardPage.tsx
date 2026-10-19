import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "@shared/i18n";
import type { DashboardAttention, DashboardCounts } from "@shared/types";
import type { AppModel } from "../App";
import { StatusBadge, issueTone, taskTone } from "../StatusBadge";

function stamp(value: string): string {
  return value.replace("T", " ").slice(0, 16);
}

export function DashboardPage({ model }: { model: AppModel }): JSX.Element {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [attention, setAttention] = useState<DashboardAttention | null>(null);
  useEffect(() => {
    if (!model.constituencyId || !model.boundaryVersionId) {
      setCounts(null);
      setAttention(null);
      return;
    }
    Promise.all([
      model.api.dashboardCounts({ constituencyId: model.constituencyId, boundaryVersionId: model.boundaryVersionId }),
      model.api.dashboardAttention({ constituencyId: model.constituencyId })
    ])
      .then(([nextCounts, nextAttention]) => {
        setCounts(nextCounts);
        setAttention(nextAttention);
      })
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.api, model.boundaryVersionId, model.constituencyId, model.setError]);

  if (!model.constituencyId) {
    return (
      <div className="card empty">
        <h2>{t(model.locale, "emptyTitle")}</h2>
        <p>Create an assembly constituency in Settings to begin. The database starts empty.</p>
        <Link className="btn" to="/settings">
          Open Settings
        </Link>
      </div>
    );
  }

  const cards = counts
    ? [
        ["Mandals", counts.mandals],
        ["Gram Panchayats", counts.gramPanchayats],
        ["Villages", counts.villages],
        ["Urban local bodies", counts.urbanLocalBodies],
        ["Rural wards", counts.ruralWards],
        ["Urban wards", counts.urbanWards],
        ["Election workspaces", counts.electionWorkspaces]
      ]
    : [];

  return (
    <section className="grid">
      <h1>Dashboard</h1>
      <p className="lede">Counts use distinct units in the selected constituency coverage. Partial coverage is never treated as complete.</p>
      <div className="grid stats">
        {cards.map(([label, value]) => (
          <article className="card stat" key={String(label)} data-testid={`stat-${String(label).toLowerCase().replaceAll(" ", "-")}`}>
            <span>{label}</span>
            <b data-testid={`stat-value-${String(label).toLowerCase().replaceAll(" ", "-")}`}>{value}</b>
          </article>
        ))}
      </div>
      <div className="row">
        <Link className="btn" to="/coverage">
          Map coverage
        </Link>
        <Link className="btn secondary" to="/voters">
          Electoral roll
        </Link>
        <Link className="btn secondary" to="/rural">
          Rural areas
        </Link>
        <Link className="btn secondary" to="/urban">
          Urban areas
        </Link>
      </div>
      <div className="grid two-col">
        <article className="card raised grid" data-testid="dashboard-overdue">
          <h2>Overdue tasks</h2>
          {attention?.overdueTasks.length ? (
            <ul className="work-list">
              {attention.overdueTasks.map((item) => (
                <li key={item.id}>
                  <Link to={item.href}>{item.title}</Link>
                  <span className="history">
                    {item.wardName} · due {item.dueDate}{" "}
                    <StatusBadge tone="danger">overdue</StatusBadge>
                    {" "}
                    <StatusBadge tone={taskTone(item.status ?? "open")}>
                      {item.status === "done" ? "completed" : (item.status ?? "open").replaceAll("_", " ")}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No overdue tasks in this constituency.</p>
          )}
        </article>
        <article className="card raised grid" data-testid="dashboard-issues">
          <h2>Unresolved issues</h2>
          {attention?.unresolvedIssues.length ? (
            <ul className="work-list">
              {attention.unresolvedIssues.map((item) => (
                <li key={item.id}>
                  <Link to={item.href}>
                    {item.referenceNumber ? `${item.referenceNumber} ` : ""}
                    {item.title}
                  </Link>
                  <span className="history">
                    {item.wardName} <StatusBadge tone={issueTone(item.status ?? "open")}>{(item.status ?? "open").replaceAll("_", " ")}</StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No unresolved issues in this constituency.</p>
          )}
        </article>
      </div>
      <article className="card raised grid" data-testid="dashboard-activity">
        <h2>Recent activity</h2>
        {attention?.recentActivity.length ? (
          <ul className="work-list">
            {attention.recentActivity.map((item) => (
              <li key={`${item.kind}-${item.recordId}-${item.at}`}>
                {item.href ? <Link to={item.href}>{item.action ?? item.kind} · {item.record ?? item.summary}</Link> : <span>{item.summary}</span>}
                <span className="history">
                  {item.wardName ? `${item.wardName} · ` : ""}
                  {stamp(item.at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">No workspace activity recorded for this constituency yet.</p>
        )}
      </article>
    </section>
  );
}
