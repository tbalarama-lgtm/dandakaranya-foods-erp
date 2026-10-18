import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ConstituencyCoverage,
  CoverageKind,
  GramPanchayat,
  Mandal,
  UnitType,
  UrbanLocalBody,
  Village,
  WardListItem
} from "@shared/types";
import type { AppModel } from "../App";

interface NamedOption {
  id: string;
  name: string;
}

export function CoveragePage({ model }: { model: AppModel }): JSX.Element {
  const [rows, setRows] = useState<ConstituencyCoverage[]>([]);
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [gps, setGps] = useState<GramPanchayat[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [ulbs, setUlbs] = useState<UrbanLocalBody[]>([]);
  const [ruralWards, setRuralWards] = useState<WardListItem[]>([]);
  const [urbanWards, setUrbanWards] = useState<WardListItem[]>([]);
  const [unitType, setUnitType] = useState<UnitType>("mandal");
  const [unitId, setUnitId] = useState("");
  const [kind, setKind] = useState<CoverageKind>("partial");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(): Promise<void> {
    if (!model.constituencyId || !model.boundaryVersionId) return;
    const [coverage, allMandals, allGps, allVillages, allUlbs, rural, urban] = await Promise.all([
      model.api.coverageList({ constituencyId: model.constituencyId, boundaryVersionId: model.boundaryVersionId }),
      model.api.mandalList({ includeArchived: false }),
      model.api.gpList({ includeArchived: false }),
      model.api.villageList({ includeArchived: false }),
      model.api.ulbList({ includeArchived: false }),
      model.api.wardList({
        classification: "rural",
        includeArchived: false,
        page: 1,
        pageSize: 200
      }),
      model.api.wardList({
        classification: "urban",
        includeArchived: false,
        page: 1,
        pageSize: 200
      })
    ]);
    setRows(coverage);
    setMandals(allMandals);
    setGps(allGps);
    setVillages(allVillages);
    setUlbs(allUlbs);
    setRuralWards(rural.items);
    setUrbanWards(urban.items);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.constituencyId, model.boundaryVersionId]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of mandals) map.set(`mandal:${item.id}`, item.name);
    for (const item of gps) map.set(`gram_panchayat:${item.id}`, item.name);
    for (const item of villages) map.set(`village:${item.id}`, item.name);
    for (const item of ulbs) map.set(`urban_local_body:${item.id}`, item.name);
    for (const item of ruralWards) map.set(`rural_ward:${item.id}`, `${item.wardNumber} ${item.name}`);
    for (const item of urbanWards) map.set(`urban_ward:${item.id}`, `${item.wardNumber} ${item.name}`);
    return map;
  }, [mandals, gps, villages, ulbs, ruralWards, urbanWards]);

  const options: NamedOption[] =
    unitType === "mandal"
      ? mandals
      : unitType === "gram_panchayat"
        ? gps
        : unitType === "village"
          ? villages
          : unitType === "urban_local_body"
            ? ulbs
            : unitType === "rural_ward"
              ? ruralWards.map((w) => ({ id: w.id, name: `${w.wardNumber} ${w.name}` }))
              : urbanWards.map((w) => ({ id: w.id, name: `${w.wardNumber} ${w.name}` }));

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!model.constituencyId || !model.boundaryVersionId) {
      model.setError("Select a constituency and boundary version first.");
      return;
    }
    if (!unitId) {
      model.setError("Select a geographic unit to map.");
      return;
    }
    setBusy(true);
    model.setError(null);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <h1>Constituency coverage</h1>
      <p>
        Administrative geography is separate from constituency coverage. Partial coverage never expands to child units.
        Official codes are stored only when you supply them.
      </p>
      <form className="card grid" onSubmit={onSubmit} data-testid="coverage-form">
        <label>
          Unit type
          <select
            id="coverage-unit-type"
            data-testid="coverage-unit-type"
            value={unitType}
            onChange={(e) => {
              setUnitType(e.target.value as UnitType);
              setUnitId("");
            }}
          >
            <option value="mandal">Mandal</option>
            <option value="gram_panchayat">Gram Panchayat</option>
            <option value="village">Village</option>
            <option value="urban_local_body">Urban local body</option>
            <option value="rural_ward">Rural ward</option>
            <option value="urban_ward">Urban ward</option>
          </select>
        </label>
        <label>
          Unit
          <select
            id="coverage-unit-id"
            data-testid="coverage-unit-id"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {options.length === 0 ? (
          <p className="empty">No units of this type exist yet. Create them under Rural or Urban first.</p>
        ) : null}
        <label>
          Coverage
          <select
            id="coverage-kind"
            data-testid="coverage-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as CoverageKind)}
          >
            <option value="partial">Partial — children are not implied</option>
            <option value="complete">Complete — children are included</option>
          </select>
        </label>
        <label>
          Notes
          <input id="coverage-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn" id="coverage-save" data-testid="coverage-save" disabled={busy} type="submit">
          Save mapping
        </button>
      </form>
      <article className="card">
        <table className="table" data-testid="coverage-table">
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
              <tr key={row.id} data-testid={`coverage-row-${row.unitType}-${row.coverageKind}`}>
                <td>{row.unitType.replaceAll("_", " ")}</td>
                <td>{names.get(`${row.unitType}:${row.unitId}`) ?? row.unitId}</td>
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
