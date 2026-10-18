import { FormEvent, useEffect, useState } from "react";
import type { ConstituencyCoverage, CoverageKind, Mandal, UnitType, UrbanLocalBody } from "@shared/types";
import type { AppModel } from "../App";

export function CoveragePage({ model }: { model: AppModel }): JSX.Element {
  const [rows, setRows] = useState<ConstituencyCoverage[]>([]);
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [ulbs, setUlbs] = useState<UrbanLocalBody[]>([]);
  const [unitType, setUnitType] = useState<UnitType>("mandal");
  const [unitId, setUnitId] = useState("");
  const [kind, setKind] = useState<CoverageKind>("partial");
  const [notes, setNotes] = useState("");

  async function load(): Promise<void> {
    if (!model.constituencyId || !model.boundaryVersionId) return;
    const [coverage, allMandals, allUlbs] = await Promise.all([
      model.api.coverageList({ constituencyId: model.constituencyId, boundaryVersionId: model.boundaryVersionId }),
      model.api.mandalList({ includeArchived: false }),
      model.api.ulbList({ includeArchived: false })
    ]);
    setRows(coverage);
    setMandals(allMandals);
    setUlbs(allUlbs);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.constituencyId, model.boundaryVersionId]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!model.constituencyId || !model.boundaryVersionId) return;
    try {
      await model.api.coverageSet({
        constituencyId: model.constituencyId,
        boundaryVersionId: model.boundaryVersionId,
        unitType,
        unitId,
        coverageKind: kind,
        notes
      });
      setNotes("");
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  const options =
    unitType === "mandal"
      ? mandals
      : unitType === "urban_local_body"
        ? ulbs
        : [];

  return (
    <section className="grid">
      <h1>Constituency coverage</h1>
      <p>
        Administrative geography is separate from constituency coverage. Partial coverage never expands to child units.
        Official codes are stored only when you supply them.
      </p>
      <form className="card grid" onSubmit={onSubmit}>
        <label>
          Unit type
          <select value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
            <option value="mandal">Mandal</option>
            <option value="gram_panchayat">Gram Panchayat</option>
            <option value="village">Village</option>
            <option value="urban_local_body">Urban local body</option>
            <option value="rural_ward">Rural ward</option>
            <option value="urban_ward">Urban ward</option>
          </select>
        </label>
        {options.length ? (
          <label>
            Unit
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
              <option value="">Select…</option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Unit id
            <input required value={unitId} onChange={(e) => setUnitId(e.target.value)} />
          </label>
        )}
        <label>
          Coverage
          <select value={kind} onChange={(e) => setKind(e.target.value as CoverageKind)}>
            <option value="partial">Partial — children are not implied</option>
            <option value="complete">Complete — children are included</option>
          </select>
        </label>
        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          Save mapping
        </button>
      </form>
      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Unit</th>
              <th>Coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.unitType}</td>
                <td>{row.unitId}</td>
                <td>
                  <span className={`chip${row.coverageKind === "partial" ? " warn" : ""}`}>{row.coverageKind}</span>
                </td>
                <td>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("Remove this coverage mapping?")) return;
                      await model.api.coverageDelete(row.id);
                      await load();
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No coverage mapped for this constituency and boundary version.</p> : null}
      </article>
    </section>
  );
}
