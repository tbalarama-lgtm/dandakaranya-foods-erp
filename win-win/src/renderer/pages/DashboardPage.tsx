import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "@shared/i18n";
import type { DashboardCounts } from "@shared/types";
import type { AppModel } from "../App";

export function DashboardPage({ model }: { model: AppModel }): JSX.Element {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  useEffect(() => {
    if (!model.constituencyId || !model.boundaryVersionId) {
      setCounts(null);
      return;
    }
    model.api
      .dashboardCounts({ constituencyId: model.constituencyId, boundaryVersionId: model.boundaryVersionId })
      .then(setCounts)
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.api, model.boundaryVersionId, model.constituencyId, model.setError]);

  if (!model.constituencyId) {
    return (
      <div className="card empty">
        <h2>{t(model.locale, "emptyTitle")}</h2>
        <p>Create an assembly constituency in Settings to begin. The database starts empty.</p>
        <Link to="/settings">Open Settings</Link>
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
      <p className="breadcrumb">Counts use distinct units in the selected constituency coverage. Partial coverage is never treated as complete.</p>
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
    </section>
  );
}
