import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CoverageKind, UrbanBodyType, UrbanLocalBody, WardListItem } from "@shared/types";
import type { AppModel } from "../App";

export function UrbanPage({ model }: { model: AppModel }): JSX.Element {
  const navigate = useNavigate();
  const [bodies, setBodies] = useState<UrbanLocalBody[]>([]);
  const [ulbId, setUlbId] = useState("");
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [bodyName, setBodyName] = useState("");
  const [bodyNameTe, setBodyNameTe] = useState("");
  const [wardName, setWardName] = useState("");
  const [wardNameTe, setWardNameTe] = useState("");
  const [bodyType, setBodyType] = useState<UrbanBodyType>("municipality");
  const [wardNumber, setWardNumber] = useState("");
  const [mapKind, setMapKind] = useState<CoverageKind | "none">("partial");
  const [busy, setBusy] = useState(false);

  async function load(): Promise<void> {
    const list = await model.api.ulbList({
      constituencyId: model.constituencyId || undefined,
      boundaryVersionId: model.boundaryVersionId || undefined
    });
    setBodies(list);
    if (ulbId) {
      const page = await model.api.wardList({
        localBodyId: ulbId,
        classification: "urban",
        constituencyId: model.constituencyId || undefined,
        boundaryVersionId: model.boundaryVersionId,
        page: 1,
        pageSize: 50
      });
      setWards(page.items);
    } else setWards([]);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.constituencyId, model.boundaryVersionId, ulbId]);

  async function createBody(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    model.setError(null);
    try {
      const created = await model.api.ulbCreate({ name: bodyName, nameTe: bodyNameTe, bodyType });
      if (mapKind !== "none" && model.constituencyId && model.boundaryVersionId) {
        await model.api.coverageSet({
          constituencyId: model.constituencyId,
          boundaryVersionId: model.boundaryVersionId,
          unitType: "urban_local_body",
          unitId: created.id,
          coverageKind: mapKind
        });
      }
      setBodyName("");
      setBodyNameTe("");
      setUlbId(created.id);
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createWard(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!ulbId || !model.boundaryVersionId) {
      model.setError("Select an urban local body and a boundary version first.");
      return;
    }
    setBusy(true);
    model.setError(null);
    try {
      await model.api.wardCreate({
        classification: "urban",
        urbanLocalBodyId: ulbId,
        boundaryVersionId: model.boundaryVersionId,
        wardNumber,
        name: wardName.trim() || `Ward ${wardNumber}`,
        nameTe: wardNameTe
      });
      setWardNumber("");
      setWardName("");
      setWardNameTe("");
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <h1>Urban areas</h1>
      <p className="breadcrumb">Urban local body → Wards. Mandal association is optional and not a navigation level.</p>
      <div className="row">
        {bodies.map((body) => (
          <button
            key={body.id}
            className={`btn ${ulbId === body.id ? "" : "secondary"}`}
            type="button"
            data-name={body.name}
            onClick={() => setUlbId(body.id)}
          >
            {body.name} ({body.bodyType.replaceAll("_", " ")})
          </button>
        ))}
      </div>
      {bodies.length === 0 ? <p className="empty">No urban local bodies in this constituency coverage yet.</p> : null}
      <article className="card">
        <h3>Urban wards</h3>
        <table className="table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {wards.map((w) => (
              <tr key={w.id}>
                <td>{w.wardNumber}</td>
                <td>{w.name}</td>
                <td>
                  <button className="btn secondary" type="button" onClick={() => navigate(`/wards/${w.id}`)}>
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <form className="card grid" onSubmit={createBody} data-testid="ulb-create-form">
        <h3>Create urban local body</h3>
        <label>
          Type
          <select id="ulb-type" value={bodyType} onChange={(e) => setBodyType(e.target.value as UrbanBodyType)}>
            <option value="municipality">Municipality</option>
            <option value="municipal_corporation">Municipal Corporation</option>
            <option value="nagar_panchayat">Nagar Panchayat</option>
          </select>
        </label>
        <label>
          Name
          <input id="ulb-name" required value={bodyName} onChange={(e) => setBodyName(e.target.value)} />
        </label>
        <label>
          Telugu name
          <input id="ulb-name-te" value={bodyNameTe} onChange={(e) => setBodyNameTe(e.target.value)} />
        </label>
        <label>
          Constituency coverage
          <select id="ulb-map-kind" data-testid="ulb-map-kind" value={mapKind} onChange={(e) => setMapKind(e.target.value as CoverageKind | "none")}>
            <option value="partial">Partial — only explicitly mapped wards</option>
            <option value="complete">Complete — include all wards</option>
            <option value="none">Do not map yet</option>
          </select>
        </label>
        <button className="btn" id="ulb-create" data-testid="ulb-create" disabled={busy} type="submit">
          Create local body
        </button>
      </form>
      <form className="card grid" onSubmit={createWard} data-testid="urban-ward-form">
        <h3>Create urban ward</h3>
        <label>
          Ward number
          <input id="urban-ward-number" required value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} />
        </label>
        <label>
          Name
          <input id="urban-ward-name" required value={wardName} onChange={(e) => setWardName(e.target.value)} />
        </label>
        <label>
          Telugu name
          <input value={wardNameTe} onChange={(e) => setWardNameTe(e.target.value)} />
        </label>
        <button className="btn" id="urban-ward-create" disabled={!ulbId || busy} type="submit">
          Create ward
        </button>
      </form>
    </section>
  );
}
