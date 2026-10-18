import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GramPanchayat, Mandal, Village, WardListItem } from "@shared/types";
import type { AppModel } from "../App";

export function RuralPage({ model }: { model: AppModel }): JSX.Element {
  const navigate = useNavigate();
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [mandalId, setMandalId] = useState("");
  const [gps, setGps] = useState<GramPanchayat[]>([]);
  const [gpId, setGpId] = useState("");
  const [villages, setVillages] = useState<Village[]>([]);
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [name, setName] = useState("");
  const [nameTe, setNameTe] = useState("");
  const [creating, setCreating] = useState<"mandal" | "gp" | "village" | "ward">("mandal");

  async function load(): Promise<void> {
    const list = await model.api.mandalList({
      constituencyId: model.constituencyId || undefined,
      boundaryVersionId: model.boundaryVersionId || undefined
    });
    setMandals(list);
    if (mandalId) {
      const gpList = await model.api.gpList({
        mandalId,
        constituencyId: model.constituencyId || undefined,
        boundaryVersionId: model.boundaryVersionId || undefined
      });
      setGps(gpList);
    } else setGps([]);
    if (gpId) {
      const [v, w] = await Promise.all([
        model.api.villageList({
          gramPanchayatId: gpId,
          constituencyId: model.constituencyId || undefined,
          boundaryVersionId: model.boundaryVersionId || undefined
        }),
        model.api.wardList({
          localBodyId: gpId,
          classification: "rural",
          constituencyId: model.constituencyId || undefined,
          boundaryVersionId: model.boundaryVersionId,
          page: 1,
          pageSize: 50
        })
      ]);
      setVillages(v);
      setWards(w.items);
    } else {
      setVillages([]);
      setWards([]);
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.constituencyId, model.boundaryVersionId, mandalId, gpId]);

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      if (creating === "mandal") {
        const created = await model.api.mandalCreate({ name, nameTe });
        if (model.constituencyId && model.boundaryVersionId) {
          const kind = window.confirm("Map this mandal as COMPLETE coverage? Cancel for PARTIAL.")
            ? "complete"
            : "partial";
          await model.api.coverageSet({
            constituencyId: model.constituencyId,
            boundaryVersionId: model.boundaryVersionId,
            unitType: "mandal",
            unitId: created.id,
            coverageKind: kind
          });
        }
        setMandalId(created.id);
      } else if (creating === "gp") {
        if (!mandalId) throw new Error("Select a mandal first.");
        const created = await model.api.gpCreate({ mandalId, name, nameTe });
        setGpId(created.id);
      } else if (creating === "village") {
        if (!gpId) throw new Error("Select a Gram Panchayat first.");
        await model.api.villageCreate({ gramPanchayatId: gpId, name, nameTe });
      } else {
        if (!gpId || !model.boundaryVersionId) throw new Error("Select a Gram Panchayat and boundary version.");
        await model.api.wardCreate({
          classification: "rural",
          gramPanchayatId: gpId,
          boundaryVersionId: model.boundaryVersionId,
          wardNumber: name,
          name: nameTe || `Ward ${name}`,
          nameTe: nameTe
        });
      }
      setName("");
      setNameTe("");
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="grid">
      <h1>Rural areas</h1>
      <p className="breadcrumb">Mandal → Gram Panchayat → Villages / Wards</p>
      <div className="grid stats">
        <article className="card">
          <h3>Mandals</h3>
          {mandals.map((m) => (
            <button key={m.id} className={`btn ${mandalId === m.id ? "" : "secondary"}`} type="button" onClick={() => setMandalId(m.id)}>
              {m.name} {m.nameTe}
            </button>
          ))}
          {mandals.length === 0 ? <p className="empty">No mandals in this constituency coverage.</p> : null}
        </article>
        <article className="card">
          <h3>Gram Panchayats</h3>
          {gps.map((gp) => (
            <button key={gp.id} className={`btn ${gpId === gp.id ? "" : "secondary"}`} type="button" onClick={() => setGpId(gp.id)}>
              {gp.name}
            </button>
          ))}
        </article>
      </div>
      <article className="card">
        <h3>Villages</h3>
        <ul>
          {villages.map((v) => (
            <li key={v.id}>
              {v.name} {v.nameTe}
            </li>
          ))}
        </ul>
        <h3>Rural wards</h3>
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
                <td>
                  {w.name} {w.nameTe}
                </td>
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
      <form className="card grid" onSubmit={create}>
        <h3>Create</h3>
        <label>
          Record type
          <select value={creating} onChange={(e) => setCreating(e.target.value as typeof creating)}>
            <option value="mandal">Mandal</option>
            <option value="gp">Gram Panchayat</option>
            <option value="village">Village</option>
            <option value="ward">Rural ward (number in first field)</option>
          </select>
        </label>
        <label>
          {creating === "ward" ? "Ward number" : "Name"}
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {creating === "ward" ? "Ward name / Telugu" : "Telugu name"}
          <input value={nameTe} onChange={(e) => setNameTe(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          Create
        </button>
      </form>
      <Link to="/coverage">Map constituency coverage</Link>
    </section>
  );
}
