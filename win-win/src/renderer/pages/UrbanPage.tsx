import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UrbanBodyType, UrbanLocalBody, WardListItem } from "@shared/types";
import type { AppModel } from "../App";

export function UrbanPage({ model }: { model: AppModel }): JSX.Element {
  const navigate = useNavigate();
  const [bodies, setBodies] = useState<UrbanLocalBody[]>([]);
  const [ulbId, setUlbId] = useState("");
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [name, setName] = useState("");
  const [nameTe, setNameTe] = useState("");
  const [bodyType, setBodyType] = useState<UrbanBodyType>("municipality");
  const [wardNumber, setWardNumber] = useState("");

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
    try {
      const created = await model.api.ulbCreate({ name, nameTe, bodyType });
      if (model.constituencyId && model.boundaryVersionId) {
        const kind = window.confirm("Map as COMPLETE coverage of this urban body? Cancel for PARTIAL.")
          ? "complete"
          : "partial";
        await model.api.coverageSet({
          constituencyId: model.constituencyId,
          boundaryVersionId: model.boundaryVersionId,
          unitType: "urban_local_body",
          unitId: created.id,
          coverageKind: kind
        });
      }
      setName("");
      setNameTe("");
      setUlbId(created.id);
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createWard(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!ulbId || !model.boundaryVersionId) return;
    try {
      await model.api.wardCreate({
        classification: "urban",
        urbanLocalBodyId: ulbId,
        boundaryVersionId: model.boundaryVersionId,
        wardNumber,
        name: name || `Ward ${wardNumber}`,
        nameTe
      });
      setWardNumber("");
      setName("");
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="grid">
      <h1>Urban areas</h1>
      <p className="breadcrumb">Urban local body → Wards. Mandal association is optional and not a navigation level.</p>
      <div className="row">
        {bodies.map((body) => (
          <button key={body.id} className={`btn ${ulbId === body.id ? "" : "secondary"}`} type="button" onClick={() => setUlbId(body.id)}>
            {body.name} ({body.bodyType.replaceAll("_", " ")})
          </button>
        ))}
      </div>
      {bodies.length === 0 ? <p className="empty">No urban local bodies in this constituency coverage.</p> : null}
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
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <form className="card grid" onSubmit={createBody}>
        <h3>Create urban local body</h3>
        <label>
          Type
          <select value={bodyType} onChange={(e) => setBodyType(e.target.value as UrbanBodyType)}>
            <option value="municipality">Municipality</option>
            <option value="municipal_corporation">Municipal Corporation</option>
            <option value="nagar_panchayat">Nagar Panchayat</option>
          </select>
        </label>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Telugu name
          <input value={nameTe} onChange={(e) => setNameTe(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          Create
        </button>
      </form>
      <form className="card grid" onSubmit={createWard}>
        <h3>Create urban ward</h3>
        <label>
          Ward number
          <input required value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn" disabled={!ulbId} type="submit">
          Create ward
        </button>
      </form>
    </section>
  );
}
