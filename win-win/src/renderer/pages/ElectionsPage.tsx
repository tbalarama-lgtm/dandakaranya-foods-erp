import { FormEvent, useEffect, useState } from "react";
import type { ElectionType, ElectionWorkspace, WardListItem, WorkspaceStatus } from "@shared/types";
import type { AppModel } from "../App";

export function ElectionsPage({ model }: { model: AppModel }): JSX.Element {
  const [rows, setRows] = useState<ElectionWorkspace[]>([]);
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [type, setType] = useState<ElectionType>("assembly");
  const [status, setStatus] = useState<WorkspaceStatus>("draft");
  const [notes, setNotes] = useState("");

  async function load(): Promise<void> {
    const [elections, wardPage] = await Promise.all([
      model.api.electionList({ constituencyId: model.constituencyId || undefined, includeArchived: true }),
      model.constituencyId && model.boundaryVersionId
        ? model.api.wardList({
            constituencyId: model.constituencyId,
            boundaryVersionId: model.boundaryVersionId,
            page: 1,
            pageSize: 100
          })
        : Promise.resolve({ items: [] as WardListItem[] })
    ]);
    setRows(elections);
    setWards(wardPage.items);
  }

  useEffect(() => {
    load().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.constituencyId, model.boundaryVersionId]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    model.setError(null);
    if (!model.constituencyId || !model.boundaryVersionId) {
      model.setError("Select a constituency and boundary version first.");
      return;
    }
    try {
      await model.api.electionCreate({
        name,
        electionType: type,
        year,
        constituencyId: model.constituencyId,
        boundaryVersionId: model.boundaryVersionId,
        status,
        notes,
        wardIds: selected,
        coverage: []
      });
      setName("");
      setSelected([]);
      await load();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="grid">
      <h1>Election workspaces</h1>
      <p>Archives keep original geographic snapshots. Changing current boundaries does not rewrite archived records.</p>
      <article className="card">
        <table className="table" data-testid="election-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Year</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.electionType}</td>
                <td>{row.year}</td>
                <td>
                  <span className="chip">{row.status}</span>
                </td>
                <td>
                  {row.status !== "archived" ? (
                    <button
                      className="btn secondary"
                      type="button"
                      data-testid={`election-archive-${row.id}`}
                      onClick={async () => {
                        if (!window.confirm("Archive this workspace and freeze its geographic references?")) return;
                        await model.api.electionArchive(row.id);
                        await load();
                      }}
                    >
                      Archive
                    </button>
                  ) : (
                    "Frozen"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No election workspaces yet.</p> : null}
      </article>
      <form className="card grid" onSubmit={onSubmit} data-testid="election-form">
        <h2>Create workspace</h2>
        <label>
          Name
          <input id="election-name" data-testid="election-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as ElectionType)}>
            <option value="assembly">Assembly</option>
            <option value="gram_panchayat">Gram Panchayat</option>
            <option value="municipality">Municipality</option>
            <option value="municipal_corporation">Municipal Corporation</option>
            <option value="nagar_panchayat">Nagar Panchayat</option>
          </select>
        </label>
        <label>
          Year
          <input type="number" required value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as WorkspaceStatus)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <fieldset>
          <legend>Wards in selected coverage</legend>
          {wards.map((ward) => (
            <label key={ward.id}>
              <input
                type="checkbox"
                checked={selected.includes(ward.id)}
                onChange={(e) =>
                  setSelected((curr) => (e.target.checked ? [...curr, ward.id] : curr.filter((id) => id !== ward.id)))
                }
              />
              {ward.classification} {ward.wardNumber} {ward.name}
            </label>
          ))}
        </fieldset>
        <button className="btn" id="election-create" data-testid="election-create" type="submit">
          Create
        </button>
      </form>
    </section>
  );
}
