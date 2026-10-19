import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GramPanchayat, Mandal, PagedResult, UrbanLocalBody, WardClassification, WardListItem } from "@shared/types";
import type { AppModel } from "../App";

export function WardsPage({ model }: { model: AppModel }): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [classification, setClassification] = useState<WardClassification | "">("");
  const [mandalId, setMandalId] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<WardListItem> | null>(null);
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [ulbs, setUlbs] = useState<UrbanLocalBody[]>([]);
  const [gps, setGps] = useState<GramPanchayat[]>([]);
  const [localBodyId, setLocalBodyId] = useState("");

  useEffect(() => {
    model.api.mandalList({ includeArchived: false }).then(setMandals).catch(() => undefined);
    model.api.ulbList({ includeArchived: false }).then(setUlbs).catch(() => undefined);
    model.api.gpList({ includeArchived: false }).then(setGps).catch(() => undefined);
  }, [model.api]);

  useEffect(() => {
    model.api
      .wardList({
        query,
        classification,
        mandalId: mandalId || null,
        localBodyId: localBodyId || null,
        constituencyId: model.constituencyId || null,
        boundaryVersionId: model.boundaryVersionId,
        page,
        pageSize: 25
      })
      .then(setResult)
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [query, classification, mandalId, localBodyId, page, model.constituencyId, model.boundaryVersionId]);

  return (
    <section className="grid">
      <h1>All wards</h1>
      <div className="row">
        <div className="search">
          <input
            data-testid="ward-search"
            placeholder="Search number, name or parent (Telugu supported)"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
          />
        </div>
        <select
          data-testid="ward-classification"
          value={classification}
          onChange={(e) => setClassification(e.target.value as WardClassification | "")}
        >
          <option value="">Rural and urban</option>
          <option value="rural">Rural</option>
          <option value="urban">Urban</option>
        </select>
        <select data-testid="ward-mandal" value={mandalId} onChange={(e) => setMandalId(e.target.value)}>
          <option value="">All mandals</option>
          {mandals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select data-testid="ward-local-body" value={localBodyId} onChange={(e) => setLocalBodyId(e.target.value)}>
          <option value="">All local bodies</option>
          {gps.map((gp) => (
            <option key={gp.id} value={gp.id}>
              {gp.name} (GP)
            </option>
          ))}
          {ulbs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} (ULB)
            </option>
          ))}
        </select>
      </div>
      <article className="card">
        <table className="table" data-testid="ward-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Name</th>
              <th>Type</th>
              <th>Parent</th>
              <th>Coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result?.items.map((ward) => (
              <tr key={ward.id}>
                <td>{ward.wardNumber}</td>
                <td>
                  {ward.name} {ward.nameTe}
                </td>
                <td>
                  <span className="chip">{ward.classification}</span>
                </td>
                <td>{ward.parentName}</td>
                <td>{ward.constituencyCoverageKind}</td>
                <td>
                  <button className="btn secondary" type="button" onClick={() => navigate(`/wards/${ward.id}`)}>
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result && result.total === 0 ? <p className="empty">No wards match these filters.</p> : null}
        <div className="pager">
          <span>
            {result ? `${result.total} records` : ""}
          </span>
          <div className="row">
            <button className="btn secondary" disabled={page <= 1} type="button" onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button
              className="btn secondary"
              disabled={!result || page * result.pageSize >= result.total}
              type="button"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
