import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CoverageKind, Village, WardDetail } from "@shared/types";
import type { AppModel } from "../App";

export function WardDetailPage({ model }: { model: AppModel }): JSX.Element {
  const { id } = useParams();
  const [detail, setDetail] = useState<WardDetail | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [villageId, setVillageId] = useState("");
  const [kind, setKind] = useState<CoverageKind>("complete");

  async function load(): Promise<void> {
    if (!id) return;
    const next = await model.api.wardGet(id);
    setDetail(next);
    if (next.ward.classification === "rural" && next.ward.gramPanchayatId) {
      setVillages(await model.api.villageList({ gramPanchayatId: next.ward.gramPanchayatId }));
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  async function mapVillage(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!id) return;
    try {
      await model.api.villageWardSet({ villageId, wardId: id, coverageKind: kind });
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!detail) return <p>Loading ward…</p>;
  const b = detail.breadcrumb;
  const crumbs = [
    b.mandal?.name,
    b.gramPanchayat?.name,
    b.urbanLocalBody?.name,
    `Ward ${detail.ward.wardNumber}`
  ].filter(Boolean);

  return (
    <section className="grid">
      <p className="breadcrumb">{crumbs.join(" → ")}</p>
      <h1>
        {detail.ward.name} <span className="chip">{detail.ward.classification}</span>
      </h1>
      <article className="card grid">
        <p>Number: {detail.ward.wardNumber}</p>
        <p>Telugu: {detail.ward.nameTe || "—"}</p>
        <p>Parent: {"mandalId" in detail.parent ? detail.parent.name : detail.parent.name}</p>
        <p>Boundary: {b.boundaryVersion?.name}</p>
        <p>Source: {detail.ward.recordSource || "—"}</p>
        <p>Last verified: {detail.ward.lastVerifiedAt || "—"}</p>
        <p>Official code: {detail.ward.officialCode || "not supplied"}</p>
        {detail.referencedByElections.length ? (
          <p>
            Used by elections: {detail.referencedByElections.map((e) => `${e.name} (${e.status})`).join(", ")}. Archive
            rather than delete to preserve history.
          </p>
        ) : null}
        <button
          className="btn danger"
          type="button"
          onClick={async () => {
            if (!window.confirm("Archive this ward? Historical election references will be kept.")) return;
            await model.api.wardArchive(detail.ward.id);
            await load();
          }}
        >
          Archive ward
        </button>
      </article>
      {detail.ward.classification === "rural" ? (
        <article className="card grid">
          <h2>Linked villages</h2>
          <ul>
            {detail.villages.map((v) => (
              <li key={v.id}>
                {v.name} — {v.coverageKind}
              </li>
            ))}
          </ul>
          {detail.villages.length === 0 ? <p className="empty">No village mappings yet.</p> : null}
          <form className="grid" onSubmit={mapVillage}>
            <label>
              Village
              <select required value={villageId} onChange={(e) => setVillageId(e.target.value)}>
                <option value="">Select…</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Coverage
              <select value={kind} onChange={(e) => setKind(e.target.value as CoverageKind)}>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
              </select>
            </label>
            <button className="btn" type="submit">
              Save mapping
            </button>
          </form>
        </article>
      ) : null}
      <p>Phase 1 workspace: identity, geography and mappings only. Voter, contact and task modules are not enabled.</p>
      <Link to="/wards">Back to directory</Link>
    </section>
  );
}
