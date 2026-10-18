import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CoverageKind, GramPanchayat, Mandal, Village, WardListItem } from "@shared/types";
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
  const [wardNumber, setWardNumber] = useState("");
  const [creating, setCreating] = useState<"mandal" | "gp" | "village" | "ward">("mandal");
  const [mapKind, setMapKind] = useState<CoverageKind | "none">("complete");
  const [busy, setBusy] = useState(false);

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

  async function maybeMap(unitType: "mandal" | "gram_panchayat", unitId: string): Promise<void> {
    if (mapKind === "none" || !model.constituencyId || !model.boundaryVersionId) return;
    await model.api.coverageSet({
      constituencyId: model.constituencyId,
      boundaryVersionId: model.boundaryVersionId,
      unitType,
      unitId,
      coverageKind: mapKind
    });
  }

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    model.setError(null);
    try {
      if (creating === "mandal") {
        const created = await model.api.mandalCreate({ name, nameTe });
        await maybeMap("mandal", created.id);
        setMandalId(created.id);
      } else if (creating === "gp") {
        if (!mandalId) throw new Error("Select a mandal first.");
        const created = await model.api.gpCreate({ mandalId, name, nameTe });
        await maybeMap("gram_panchayat", created.id);
        setGpId(created.id);
      } else if (creating === "village") {
        if (!gpId) throw new Error("Select a Gram Panchayat first.");
        await model.api.villageCreate({ gramPanchayatId: gpId, name, nameTe });
      } else {
        if (!gpId || !model.boundaryVersionId) throw new Error("Select a Gram Panchayat and boundary version.");
        if (!wardNumber.trim() || !name.trim()) throw new Error("Ward number and name are required.");
        await model.api.wardCreate({
          classification: "rural",
          gramPanchayatId: gpId,
          boundaryVersionId: model.boundaryVersionId,
          wardNumber: wardNumber.trim(),
          name: name.trim(),
          nameTe
        });
      }
      setName("");
      setNameTe("");
      setWardNumber("");
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <h1>Rural areas</h1>
      <p className="breadcrumb">Mandal → Gram Panchayat → Villages / Wards</p>
      <p>
        Lists show units mapped to the selected constituency. Create a mandal here, then map complete or partial coverage
        so it appears in this tree.
      </p>
      <div className="grid stats">
        <article className="card">
          <h3>Mandals</h3>
          {mandals.map((m) => (
            <button
              key={m.id}
              className={`btn ${mandalId === m.id ? "" : "secondary"}`}
              type="button"
              data-testid={`mandal-${m.id}`}
              data-name={m.name}
              onClick={() => setMandalId(m.id)}
            >
              {m.name} {m.nameTe}
            </button>
          ))}
          {mandals.length === 0 ? <p className="empty">No mandals in this constituency coverage yet.</p> : null}
        </article>
        <article className="card">
          <h3>Gram Panchayats</h3>
          {gps.map((gp) => (
            <button
              key={gp.id}
              className={`btn ${gpId === gp.id ? "" : "secondary"}`}
              type="button"
              data-name={gp.name}
              onClick={() => setGpId(gp.id)}
            >
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
      <form className="card grid" onSubmit={create} data-testid="rural-create-form">
        <h3>Create</h3>
        <label>
          Record type
          <select
            id="rural-record-type"
            value={creating}
            onChange={(e) => setCreating(e.target.value as typeof creating)}
          >
            <option value="mandal">Mandal</option>
            <option value="gp">Gram Panchayat</option>
            <option value="village">Village</option>
            <option value="ward">Rural ward</option>
          </select>
        </label>
        {creating === "ward" ? (
          <label>
            Ward number
            <input id="rural-ward-number" required value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} />
          </label>
        ) : null}
        <label>
          Name
          <input id="rural-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Telugu name
          <input id="rural-name-te" value={nameTe} onChange={(e) => setNameTe(e.target.value)} />
        </label>
        {creating === "mandal" || creating === "gp" ? (
          <label>
            Constituency coverage for this new record
            <select id="rural-map-kind" data-testid="rural-map-kind" value={mapKind} onChange={(e) => setMapKind(e.target.value as CoverageKind | "none")}>
              <option value="complete">Complete — include children</option>
              <option value="partial">Partial — children are not implied</option>
              <option value="none">Do not map yet</option>
            </select>
          </label>
        ) : null}
        <button className="btn" id="rural-create" data-testid="rural-create" disabled={busy} type="submit">
          Create
        </button>
      </form>
      <Link to="/coverage">Map constituency coverage</Link>
    </section>
  );
}
