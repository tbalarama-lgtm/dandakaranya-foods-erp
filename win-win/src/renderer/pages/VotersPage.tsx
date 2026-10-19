import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { VOTER_EXPORT_FIELDS, VOTER_PERSONAL_EXPORT_FIELDS, type VoterExportField } from "@shared/constants";
import type {
  DuplicatePair,
  RollEdition,
  RollEditionCounts,
  VoterDetail,
  VoterListItem,
  WardListItem
} from "@shared/types";
import type { AppModel } from "../App";
import { Dialog } from "../Dialog";
import { StatusBadge, verificationTone } from "../StatusBadge";

const EMPTY_COUNTS: RollEditionCounts = {
  rollEditionId: "",
  editionName: "",
  revisionCode: "",
  total: 0,
  assigned: 0,
  unassigned: 0,
  archived: 0,
  unverified: 0,
  verified: 0,
  needsReview: 0
};

export function VotersPage({ model }: { model: AppModel }): JSX.Element {
  const [params] = useSearchParams();
  const [editions, setEditions] = useState<RollEdition[]>([]);
  const [editionId, setEditionId] = useState(params.get("edition") ?? "");
  const [counts, setCounts] = useState<RollEditionCounts | null>(null);
  const [items, setItems] = useState<VoterListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [verification, setVerification] = useState(params.get("verification") ?? "");
  const [assignment, setAssignment] = useState<"all" | "assigned" | "unassigned">(() => {
    const value = params.get("assignment");
    return value === "unassigned" || value === "assigned" ? value : "all";
  });
  const [wardId] = useState(params.get("ward") ?? "");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [detail, setDetail] = useState<VoterDetail | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [busy, setBusy] = useState("");
  const [editionName, setEditionName] = useState("");
  const [revisionCode, setRevisionCode] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState<VoterExportField[]>([
    "displayName",
    "displayElectoralId",
    "displayRollSerial",
    "ward",
    "rollEdition"
  ]);
  const [form, setForm] = useState({
    sourceName: "",
    sourceNameEn: "",
    sourceElectoralId: "",
    sourceRollSerial: "",
    sourceAge: "",
    sourceAgeReferenceDate: "",
    sourceAddress: "",
    assignedWardId: ""
  });
  const [local, setLocal] = useState({
    localName: "",
    localElectoralId: "",
    localAddress: "",
    assignedWardId: "",
    verificationStatus: "unverified" as "unverified" | "verified" | "needs_review",
    archiveReason: ""
  });
  const [bulkWard, setBulkWard] = useState("");
  const [bulkReason, setBulkReason] = useState("Reviewed mapping");
  const [manageOpen, setManageOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(
    () => ({
      constituencyId: model.constituencyId,
      rollEditionId: editionId || null,
      wardId: wardId || null,
      query,
      verificationStatus: verification as "" | "unverified" | "verified" | "needs_review",
      unassignedOnly: assignment === "unassigned",
      assignedOnly: assignment === "assigned",
      includeArchived,
      page,
      pageSize: 25
    }),
    [model.constituencyId, editionId, wardId, query, verification, assignment, includeArchived, page]
  );

  async function loadEditions(): Promise<void> {
    if (!model.constituencyId) return;
    const next = await model.api.editionList({ constituencyId: model.constituencyId, includeArchived: true });
    setEditions(next);
    setEditionId((current) => (current && next.some((e) => e.id === current) ? current : next.find((e) => !e.archived)?.id || next[0]?.id || ""));
  }

  async function loadDirectory(nextEdition = editionId): Promise<void> {
    if (!model.constituencyId || !nextEdition) {
      setItems([]);
      setTotal(0);
      setCounts(null);
      setDuplicates([]);
      return;
    }
    const [pageResult, nextCounts, dupes, wardPage] = await Promise.all([
      model.api.voterList({
        ...filters,
        rollEditionId: nextEdition
      }),
      model.api.editionCounts({ constituencyId: model.constituencyId, rollEditionId: nextEdition }),
      model.api.duplicateList({ constituencyId: model.constituencyId, rollEditionId: nextEdition }),
      model.boundaryVersionId
        ? model.api.wardList({
            constituencyId: model.constituencyId,
            boundaryVersionId: model.boundaryVersionId,
            page: 1,
            pageSize: 200
          })
        : Promise.resolve({ items: [] as WardListItem[] })
    ]);
    setItems(pageResult.items);
    setTotal(pageResult.total);
    setCounts(nextCounts);
    setDuplicates(dupes);
    setWards(wardPage.items);
  }

  useEffect(() => {
    loadEditions().catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.constituencyId]);

  useEffect(() => {
    loadDirectory(editionId).catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [editionId, query, verification, assignment, includeArchived, page, model.constituencyId, model.boundaryVersionId]);

  if (!model.constituencyId) {
    return (
      <div className="card empty">
        <h2>Select a constituency</h2>
        <p>Electoral-roll records are scoped to the selected assembly constituency and are not linked to contact identities.</p>
      </div>
    );
  }

  async function createEdition(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!model.boundaryVersionId) {
      model.setError("Select a boundary version before creating a roll edition.");
      return;
    }
    try {
      const created = await model.api.editionCreate({
        constituencyId: model.constituencyId,
        boundaryVersionId: model.boundaryVersionId,
        name: editionName,
        revisionCode
      });
      setEditionName("");
      setRevisionCode("");
      await loadEditions();
      setEditionId(created.id);
      setManageOpen(false);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createVoter(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editionId) return;
    try {
      await model.api.voterCreate({
        constituencyId: model.constituencyId,
        rollEditionId: editionId,
        ...form,
        assignedWardId: form.assignedWardId || null
      });
      setForm({
        sourceName: "",
        sourceNameEn: "",
        sourceElectoralId: "",
        sourceRollSerial: "",
        sourceAge: "",
        sourceAgeReferenceDate: "",
        sourceAddress: "",
        assignedWardId: ""
      });
      await loadDirectory();
      setCreateOpen(false);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openDetail(id: string): Promise<void> {
    const next = await model.api.voterGet({ id, constituencyId: model.constituencyId });
    setDetail(next);
    setLocal({
      localName: next.voter.localName ?? "",
      localElectoralId: next.voter.localElectoralId ?? "",
      localAddress: next.voter.localAddress ?? "",
      assignedWardId: next.voter.assignedWardId ?? "",
      verificationStatus: next.voter.verificationStatus,
      archiveReason: ""
    });
  }

  async function saveLocal(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!detail) return;
    try {
      await model.api.voterUpdate({
        id: detail.voter.id,
        constituencyId: model.constituencyId,
        localName: local.localName,
        localElectoralId: local.localElectoralId,
        localAddress: local.localAddress,
        assignedWardId: local.assignedWardId || null,
        verificationStatus: local.verificationStatus
      });
      await openDetail(detail.voter.id);
      await loadDirectory();
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    }
  }

  const shownCounts = counts ?? EMPTY_COUNTS;

  return (
    <section className="grid">
      <header className="ward-head">
        <h1>Electoral roll</h1>
        <p className="lede">
          Source records for this constituency only. They are not contact identities and are never matched automatically by name or phone.
        </p>
      </header>
      <div className="toolbar">
        <div className="row">
          <label>
            Roll edition
            <select id="voter-edition" data-testid="voter-edition" value={editionId} onChange={(e) => { setEditionId(e.target.value); setPage(1); }}>
              <option value="">Select an edition — counts are never combined across revisions</option>
              {editions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.name}
                  {edition.revisionCode ? ` (${edition.revisionCode})` : ""}
                  {edition.archived ? " — archived" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="btn secondary" type="button" data-testid="manage-editions" onClick={() => setManageOpen(true)}>
            Manage editions
          </button>
        </div>
        <div className="row">
          <Link className="btn" to="/import" data-testid="open-import">
            Import CSV/XLSX
          </Link>
          <button className="btn secondary" type="button" data-testid="open-export" disabled={!editionId} onClick={() => setExportOpen(true)}>
            Export selection
          </button>
          <button className="btn secondary" type="button" data-testid="voter-add" disabled={!editionId} onClick={() => setCreateOpen(true)}>
            Manual entry
          </button>
        </div>
      </div>
      {editionId ? (
        <p className="counts-inline" data-testid="voter-count-reconcile">
          <span data-testid="voter-count-total">This edition <b>{shownCounts.total}</b></span>
          {" · "}
          <span data-testid="voter-count-assigned">Assigned <b>{shownCounts.assigned}</b></span>
          {" · "}
          <span data-testid="voter-count-unassigned">Unassigned <b>{shownCounts.unassigned}</b></span>
          {" · "}
          <span data-testid="voter-count-archived">Archived <b>{shownCounts.archived}</b></span>
          {" · "}Needs review {shownCounts.needsReview}
        </p>
      ) : (
        <p className="empty">Create or select a roll edition to see counts for that edition only.</p>
      )}
      <article className="card grid">
        <div className="row">
          <label>
            Search name, identifier or address
            <input id="voter-query" data-testid="voter-query" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
          </label>
          <label>
            Verification
            <select data-testid="voter-verification" value={verification} onChange={(e) => setVerification(e.target.value)}>
              <option value="">Any</option>
              <option value="unverified">Unverified</option>
              <option value="verified">Verified</option>
              <option value="needs_review">Needs review</option>
            </select>
          </label>
          <label>
            Assignment
            <select data-testid="voter-assignment" value={assignment} onChange={(e) => setAssignment(e.target.value as typeof assignment)}>
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned queue</option>
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Include archived
          </label>
        </div>
        <table className="table" data-testid="voter-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Name</th>
              <th>Identifier</th>
              <th>Serial</th>
              <th>Ward</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-voter-id={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((current) => (e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))
                    }
                  />
                </td>
                <td>
                  <button className="btn linkish" type="button" onClick={() => void openDetail(item.id)}>
                    {item.displayName || "(no name)"}
                  </button>
                  {item.displayNameEn ? <div className="history">{item.displayNameEn}</div> : null}
                </td>
                <td>{item.displayElectoralId}</td>
                <td>{item.displayRollSerial}</td>
                <td>{item.wardLabel ?? "Unassigned"}</td>
                <td>
                  <StatusBadge tone={verificationTone(item.verificationStatus)}>{item.verificationStatus.replaceAll("_", " ")}</StatusBadge>
                  {item.archived ? <span className="chip danger">archived</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="empty">No electoral-roll entries for these filters.</p> : null}
        <div className="pager">
          <span>
            Page {page} · {total} matching this edition
          </span>
          <div className="row">
            <button className="btn secondary" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn secondary" type="button" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
        <div className="row">
          <select data-testid="bulk-ward" value={bulkWard} onChange={(e) => setBulkWard(e.target.value)}>
            <option value="">Assign selected to…</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.wardNumber} — {ward.name}
              </option>
            ))}
          </select>
          <input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Assignment reason" />
          <button
            className="btn"
            type="button"
            data-testid="bulk-assign"
            disabled={selected.length === 0 || !bulkWard}
            onClick={async () => {
              try {
                await model.api.voterAssignBulk({
                  constituencyId: model.constituencyId,
                  voterIds: selected,
                  wardId: bulkWard,
                  reason: bulkReason,
                  verificationSource: "bulk-assignment"
                });
                setSelected([]);
                await loadDirectory();
              } catch (err) {
                model.setError(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Assign selected
          </button>
        </div>
      </article>
      {detail ? (
      <Dialog open title="Record details" onClose={() => setDetail(null)} wide testId="voter-detail">
        <article className="grid">
          <h2>Record details</h2>
          <p className="history">
            Source values stay unchanged. Local corrections are stored separately. Identifiers remain text.
          </p>
          <div className="two-col">
            <div>
              <h3>Source</h3>
              <p>Name: {detail.voter.sourceName}</p>
              <p>English: {detail.voter.sourceNameEn || "—"}</p>
              <p>Identifier: {detail.voter.sourceElectoralId || "—"}</p>
              <p>Serial: {detail.voter.sourceRollSerial || "—"}</p>
              <p>Age (published): {detail.voter.sourceAge || "—"} as of {detail.voter.sourceAgeReferenceDate || "—"}</p>
              <p>Address: {detail.voter.sourceAddress || "—"}</p>
              <p>Section/page: {detail.voter.sourceSection || "—"} / {detail.voter.sourcePage || "—"}</p>
              <p>Source ward label: {detail.voter.sourceWardLabel || "—"}</p>
              <p>Import: {detail.importBatch ? `${detail.importBatch.fileName} (${detail.importBatch.fileSha256.slice(0, 8)}…)` : "Manual entry"}</p>
            </div>
            <form className="grid" onSubmit={saveLocal}>
              <h3>Local correction</h3>
              <label>
                Local name
                <input value={local.localName} onChange={(e) => setLocal({ ...local, localName: e.target.value })} />
              </label>
              <label>
                Local identifier
                <input value={local.localElectoralId} onChange={(e) => setLocal({ ...local, localElectoralId: e.target.value })} />
              </label>
              <label>
                Local address
                <input value={local.localAddress} onChange={(e) => setLocal({ ...local, localAddress: e.target.value })} />
              </label>
              <label>
                Ward
                <select value={local.assignedWardId} onChange={(e) => setLocal({ ...local, assignedWardId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {wards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.wardNumber} — {ward.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Verification
                <select
                  value={local.verificationStatus}
                  onChange={(e) => setLocal({ ...local, verificationStatus: e.target.value as typeof local.verificationStatus })}
                >
                  <option value="unverified">Unverified</option>
                  <option value="verified">Verified</option>
                  <option value="needs_review">Needs review</option>
                </select>
              </label>
              <button className="btn" type="submit">
                Save local fields
              </button>
              <label>
                Archive reason
                <input data-testid="voter-archive-reason" value={local.archiveReason} onChange={(e) => setLocal({ ...local, archiveReason: e.target.value })} />
              </label>
              <button
                className="btn danger"
                type="button"
                data-testid="voter-archive"
                onClick={async () => {
                  try {
                    await model.api.voterArchive({
                      id: detail.voter.id,
                      constituencyId: model.constituencyId,
                      reason: local.archiveReason
                    });
                    setDetail(null);
                    await loadDirectory();
                  } catch (err) {
                    model.setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Archive
              </button>
            </form>
          </div>
          <h3>Assignment history</h3>
          <ul data-testid="assignment-history">
            {detail.assignmentHistory.map((row) => (
              <li key={row.id}>
                {row.changedAt}: {row.fromWardId ?? "none"} → {row.toWardId ?? "none"} ({row.reason}; {row.verificationSource || "—"})
              </li>
            ))}
          </ul>
        </article>
      </Dialog>
      ) : null}
      <article className="card grid">
        <h2>Possible duplicates in this edition</h2>
        <p>Flags are review hints. Records are never merged or deleted automatically. Other roll editions are revisions, not duplicates.</p>
        <table className="table" data-testid="duplicate-table">
          <thead>
            <tr>
              <th>A</th>
              <th>B</th>
              <th>Reasons</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {duplicates.map((pair) => (
              <tr key={pair.id}>
                <td>{pair.voterA?.displayName} / {pair.voterA?.displayElectoralId}</td>
                <td>{pair.voterB?.displayName} / {pair.voterB?.displayElectoralId}</td>
                <td>{pair.reasons.join(" ")}</td>
                <td>
                  <StatusBadge tone="warning">{pair.status.replaceAll("_", " ")}</StatusBadge>
                  {pair.status === "flagged" ? (
                    <button
                      className="btn secondary"
                      type="button"
                      data-testid={`duplicate-distinct-${pair.id}`}
                      onClick={async () => {
                        await model.api.duplicateReview({ id: pair.id, constituencyId: model.constituencyId, status: "distinct" });
                        await loadDirectory();
                      }}
                    >
                      Mark distinct
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {duplicates.length === 0 ? <p className="empty">No flagged pairs in this edition.</p> : null}
      </article>
      <Dialog open={createOpen} title="Manual entry" onClose={() => setCreateOpen(false)}>
      <form className="grid" onSubmit={createVoter} data-testid="voter-create-form">
        <p>Use only fields present on the source. Birth dates are not inferred from published age.</p>
        <label>
          Name (original script)
          <input id="voter-name" data-testid="voter-name" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} />
        </label>
        <label>
          Electoral identifier
          <input id="voter-id" data-testid="voter-id" value={form.sourceElectoralId} onChange={(e) => setForm({ ...form, sourceElectoralId: e.target.value })} />
        </label>
        <label>
          Roll serial
          <input id="voter-serial" data-testid="voter-serial" value={form.sourceRollSerial} onChange={(e) => setForm({ ...form, sourceRollSerial: e.target.value })} />
        </label>
        <label>
          Address
          <input value={form.sourceAddress} onChange={(e) => setForm({ ...form, sourceAddress: e.target.value })} />
        </label>
        <button className="btn" id="voter-create" data-testid="voter-create" type="submit" disabled={!editionId}>
          Save entry
        </button>
      </form>
      </Dialog>
      <Dialog open={manageOpen} title="Manage editions" onClose={() => setManageOpen(false)}>
        <form className="grid" onSubmit={createEdition} data-testid="edition-form">
          <p className="lede">Counts are never combined across revisions.</p>
          <label>
            Edition name
            <input id="edition-name" data-testid="edition-name" placeholder="Edition name" value={editionName} onChange={(e) => setEditionName(e.target.value)} required />
          </label>
          <label>
            Revision code
            <input id="edition-revision" data-testid="edition-revision" placeholder="Revision code" value={revisionCode} onChange={(e) => setRevisionCode(e.target.value)} />
          </label>
          <button className="btn" id="edition-create" data-testid="edition-create" type="submit">
            Create edition
          </button>
        </form>
      </Dialog>
      {exportOpen ? (
        <div className="dialog-backdrop">
          <article className="card dialog grid" data-testid="export-dialog">
            <h2>Export current filters</h2>
            <p>
              Scope: selected constituency, edition {editions.find((e) => e.id === editionId)?.name ?? "—"}. Matching records:{" "}
              <strong data-testid="export-count">{total}</strong>. Archived records {includeArchived ? "included" : "excluded"}.
            </p>
            {VOTER_EXPORT_FIELDS.map((field) => (
              <label key={field} className="row">
                <input
                  type="checkbox"
                  checked={exportFields.includes(field)}
                  onChange={(e) =>
                    setExportFields((current) => (e.target.checked ? [...current, field] : current.filter((f) => f !== field)))
                  }
                />
                {field}
                {(VOTER_PERSONAL_EXPORT_FIELDS as readonly string[]).includes(field) ? <span className="chip warn">personal</span> : null}
              </label>
            ))}
            <div className="row">
              <button
                className="btn"
                type="button"
                data-testid="export-confirm"
                disabled={exportFields.length === 0}
                onClick={async () => {
                  setBusy("Writing export…");
                  try {
                    const result = await model.api.voterExport({
                      filters: { ...filters, page: 1 },
                      fields: exportFields,
                      format: "csv"
                    });
                    if (!result.cancelled) setExportOpen(false);
                  } catch (err) {
                    model.setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy("");
                  }
                }}
              >
                Export CSV
              </button>
              <button className="btn secondary" type="button" onClick={() => setExportOpen(false)}>
                Cancel
              </button>
            </div>
            {busy ? <p data-testid="export-progress">{busy}</p> : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
