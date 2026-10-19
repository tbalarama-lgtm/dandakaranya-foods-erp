import { FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type {
  ElectionWorkspace,
  GramPanchayat,
  Mandal,
  ReservationCommitResult,
  ReservationImportSession,
  ReservationMandalProposal,
  ReservationMatrixRow,
  ReservationNotification,
  ReservationSeat,
  ReservationSummary
} from "@shared/types";
import type { AppModel } from "../App";
import { StatusBadge } from "../StatusBadge";

function SeatCode({ code, women }: { code: string; women?: boolean }): JSX.Element {
  const label = code || "Not recorded";
  return (
    <span className="seat-code">
      <StatusBadge tone="neutral">{label}</StatusBadge>
      {code && code !== "Not recorded" && code !== "Not applicable" ? (
        <StatusBadge tone={women ? "info" : "neutral"}>
          {women ? "Women-reserved" : "Not specifically reserved for women"}
        </StatusBadge>
      ) : null}
    </span>
  );
}

function useReservationScope(model: AppModel) {
  const [elections, setElections] = useState<ElectionWorkspace[]>([]);
  const [notes, setNotes] = useState<ReservationNotification[]>([]);
  const [electionId, setElectionId] = useState("");
  const [notificationId, setNotificationId] = useState("");
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [gps, setGps] = useState<GramPanchayat[]>([]);

  useEffect(() => {
    if (!model.constituencyId) return;
    model.api.electionList({ constituencyId: model.constituencyId, includeArchived: true }).then(setElections).catch(() => undefined);
    model.api.mandalList({ constituencyId: model.constituencyId, boundaryVersionId: model.boundaryVersionId || undefined }).then(setMandals).catch(() => undefined);
    model.api.gpList({ constituencyId: model.constituencyId, boundaryVersionId: model.boundaryVersionId || undefined }).then(setGps).catch(() => undefined);
  }, [model.api, model.constituencyId, model.boundaryVersionId]);

  useEffect(() => {
    if (!model.constituencyId) return;
    model.api
      .reservationNotificationList({ constituencyId: model.constituencyId, electionId: electionId || undefined })
      .then((rows) => {
        setNotes(rows);
        if (notificationId && !rows.some((row) => row.id === notificationId)) setNotificationId("");
      })
      .catch(() => undefined);
  }, [model.api, model.constituencyId, electionId]);

  return { elections, notes, electionId, setElectionId, notificationId, setNotificationId, mandals, gps };
}

function ScopeFilters({
  model,
  scope,
  extra
}: {
  model: AppModel;
  scope: ReturnType<typeof useReservationScope>;
  extra?: JSX.Element;
}): JSX.Element {
  return (
    <div className="row">
      <label>
        Election workspace
        <select data-testid="res-election" value={scope.electionId} onChange={(e) => scope.setElectionId(e.target.value)}>
          <option value="">Select…</option>
          {scope.elections.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} ({row.year})
            </option>
          ))}
        </select>
      </label>
      <label>
        Notification
        <select data-testid="res-notification" value={scope.notificationId} onChange={(e) => scope.setNotificationId(e.target.value)}>
          <option value="">Select…</option>
          {scope.notes.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.status}
            </option>
          ))}
        </select>
      </label>
      {extra}
    </div>
  );
}

function SummaryPane({ model, scope }: { model: AppModel; scope: ReturnType<typeof useReservationScope> }): JSX.Element {
  const [summary, setSummary] = useState<ReservationSummary | null>(null);
  const [verifyRef, setVerifyRef] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  useEffect(() => {
    if (!model.constituencyId || !scope.electionId) {
      setSummary(null);
      return;
    }
    model.api
      .reservationSummary({
        constituencyId: model.constituencyId,
        electionId: scope.electionId,
        notificationId: scope.notificationId || undefined
      })
      .then(setSummary)
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.api, model.constituencyId, scope.electionId, scope.notificationId]);

  if (!scope.electionId) {
    return (
      <article className="card empty">
        <h2>Select an election workspace</h2>
        <p>Seat reservations are tied to an election notification. They are not treated as permanently current geography.</p>
      </article>
    );
  }
  if (!summary?.notification) {
    return (
      <article className="card empty">
        <h2>No reservation notification</h2>
        <p>Import a reservation worksheet or create a notification in Import and Review.</p>
      </article>
    );
  }

  async function verify(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!summary?.notification) return;
    await model.api.reservationVerify({
      id: summary.notification.id,
      constituencyId: model.constituencyId,
      notificationReference: verifyRef,
      notes: verifyNotes
    });
    setVerifyRef("");
    setVerifyNotes("");
    const next = await model.api.reservationSummary({
      constituencyId: model.constituencyId,
      electionId: scope.electionId,
      notificationId: summary.notification.id
    });
    setSummary(next);
  }

  return (
    <div className="grid">
      <p className="lede" data-testid="res-summary-note">
        {summary.sourceWideNote} Status: {summary.notification.status}. Official validity is never assumed.
      </p>
      <div className="grid two-col">
        <article className="card raised grid" data-testid="res-sarpanch-summary">
          <h2>Sarpanch seats by category</h2>
          {Object.entries(summary.sarpanchByCategory).map(([code, n]) => (
            <p key={code}>
              {code}: <b>{n}</b>
            </p>
          ))}
          <p className="history">Women-reserved (overlaps categories): {summary.womenReservedBySeatType.sarpanch}</p>
        </article>
        <article className="card raised grid" data-testid="res-ward-summary">
          <h2>Ward Member seats by category</h2>
          {Object.entries(summary.wardByCategory).map(([code, n]) => (
            <p key={code}>
              {code}: <b>{n}</b>
            </p>
          ))}
          <p className="history">Women-reserved (overlaps categories): {summary.womenReservedBySeatType.ward_member}</p>
        </article>
      </div>
      <article className="card">
        <h2>Mandal-wise totals</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Mandal</th>
              <th>GPs</th>
              <th>Sarpanch</th>
              <th>Ward members</th>
            </tr>
          </thead>
          <tbody>
            {summary.mandalTotals.map((row) => (
              <tr key={row.mandal}>
                <td>{row.mandal}</td>
                <td>{row.gps}</td>
                <td>{row.sarpanch}</td>
                <td>{row.wards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <p className="counts-inline" data-testid="res-review-counts">
        Unmapped {summary.unmapped} · Unverified {summary.unverified} · Conflicting {summary.conflicting} · Imported
        sarpanch {summary.importedSarpanch} · ward members {summary.importedWardMembers}
      </p>
      <form className="card grid" onSubmit={(e) => void verify(e)} data-testid="res-verify-form">
        <h3>Verify this notification</h3>
        <p>Requires a reference and reviewer notes. This records a local verification, not official gazette validity.</p>
        <input data-testid="res-verify-ref" placeholder="Notification reference" value={verifyRef} onChange={(e) => setVerifyRef(e.target.value)} />
        <textarea data-testid="res-verify-notes" placeholder="Reviewer notes" value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} />
        <button className="btn" type="submit" disabled={!verifyRef.trim() || !verifyNotes.trim()}>
          Record verification
        </button>
      </form>
      <div className="row">
        {(["sarpanch", "ward_member", "matrix", "review"] as const).map((kind) => (
          <span key={kind} className="row">
            <button
              className="btn secondary"
              type="button"
              data-testid={`res-export-${kind}`}
              onClick={() =>
                void model.api.reservationExport({
                  constituencyId: model.constituencyId,
                  notificationId: summary.notification!.id,
                  kind,
                  format: "csv"
                })
              }
            >
              Export {kind.replaceAll("_", " ")} CSV
            </button>
            <button
              className="btn secondary"
              type="button"
              data-testid={`res-export-${kind}-xlsx`}
              onClick={() =>
                void model.api.reservationExport({
                  constituencyId: model.constituencyId,
                  notificationId: summary.notification!.id,
                  kind,
                  format: "xlsx"
                })
              }
            >
              XLSX
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function SeatList({
  model,
  scope,
  seatType
}: {
  model: AppModel;
  scope: ReturnType<typeof useReservationScope>;
  seatType: "sarpanch" | "ward_member";
}): JSX.Element {
  const [rows, setRows] = useState<ReservationSeat[]>([]);
  const [category, setCategory] = useState("");
  const [women, setWomen] = useState<"" | "yes" | "no">("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [mandalId, setMandalId] = useState("");
  const [gpId, setGpId] = useState("");

  useEffect(() => {
    if (!model.constituencyId || !scope.electionId) {
      setRows([]);
      return;
    }
    model.api
      .reservationList({
        constituencyId: model.constituencyId,
        electionId: scope.electionId,
        notificationId: scope.notificationId || undefined,
        seatType,
        category: category || undefined,
        womenReserved: women === "" ? "" : women === "yes",
        reviewStatus: status || undefined,
        year: year ? Number(year) : undefined,
        mandalId: mandalId || undefined,
        gramPanchayatId: gpId || undefined,
        page: 1,
        pageSize: 200
      })
      .then((page) => setRows(page.items))
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.api, model.constituencyId, scope.electionId, scope.notificationId, seatType, category, women, status, year, mandalId, gpId]);

  if (!scope.electionId) {
    return <p className="empty">Select an election workspace to list reservations.</p>;
  }
  return (
    <div className="grid">
      <div className="row">
        <input data-testid="res-year" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
        <select data-testid="res-mandal" value={mandalId} onChange={(e) => setMandalId(e.target.value)}>
          <option value="">All mandals</option>
          {scope.mandals.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <select data-testid="res-gp" value={gpId} onChange={(e) => setGpId(e.target.value)}>
          <option value="">All GPs</option>
          {scope.gps.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <select data-testid="res-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="UR">UR</option>
          <option value="BC">BC</option>
          <option value="SC">SC</option>
          <option value="ST">ST</option>
        </select>
        <select data-testid="res-women" value={women} onChange={(e) => setWomen(e.target.value as typeof women)}>
          <option value="">Women-reserved: any</option>
          <option value="yes">Women-reserved</option>
          <option value="no">Not specifically reserved for women</option>
        </select>
        <select data-testid="res-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All review statuses</option>
          <option value="mapped">mapped</option>
          <option value="unmatched">unmatched</option>
          <option value="mandal_needs_review">mandal needs review</option>
          <option value="ambiguous">ambiguous</option>
        </select>
      </div>
      <article className="card">
        <table className="table" data-testid={`res-${seatType}-table`}>
          <thead>
            <tr>
              <th>Mandal</th>
              <th>Gram Panchayat</th>
              {seatType === "ward_member" ? <th>Ward</th> : null}
              <th>Source code</th>
              <th>Review</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.mandalName || row.sourceMandalLabel}</td>
                <td>{row.gpName || row.sourceGpLabel}</td>
                {seatType === "ward_member" ? <td>{row.sourceWardNumber}</td> : null}
                <td>
                  <SeatCode code={row.originalCode || row.category} women={row.womenReserved} />
                </td>
                <td>{row.reviewStatus.replaceAll("_", " ")}</td>
                <td className="history">
                  {row.sourceFilename} {row.sourceWorksheet} r{row.sourceRow} {row.sourceCell}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No seats match these filters.</p> : null}
      </article>
    </div>
  );
}

function MatrixPane({ model, scope }: { model: AppModel; scope: ReturnType<typeof useReservationScope> }): JSX.Element {
  const [wardNumbers, setWardNumbers] = useState<string[]>([]);
  const [rows, setRows] = useState<ReservationMatrixRow[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!model.constituencyId || !scope.notificationId) {
      setRows([]);
      return;
    }
    model.api
      .reservationMatrix({ constituencyId: model.constituencyId, notificationId: scope.notificationId })
      .then((next) => {
        setWardNumbers(next.wardNumbers);
        setRows(next.rows);
      })
      .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
  }, [model.api, model.constituencyId, scope.notificationId]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          !query ||
          row.mandal.toLowerCase().includes(query.toLowerCase()) ||
          row.gramPanchayat.toLowerCase().includes(query.toLowerCase())
      ),
    [rows, query]
  );

  if (!scope.electionId || !scope.notificationId) {
    return <p className="empty">Select an election and notification to open the GP reservation matrix.</p>;
  }
  return (
    <div className="grid">
      <input data-testid="res-matrix-search" placeholder="Search mandal or GP" value={query} onChange={(e) => setQuery(e.target.value)} />
      <article className="card matrix-wrap">
        <table className="table matrix-table" data-testid="res-matrix">
          <thead>
            <tr>
              <th className="sticky-col c1">Mandal</th>
              <th className="sticky-col c2">Gram Panchayat</th>
              <th className="sticky-col c3">Sarpanch</th>
              <th className="sticky-col c4">Ward count</th>
              {wardNumbers.map((n) => (
                <th key={n}>Ward {n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={`${row.mandal}-${row.gramPanchayat}`}>
                <td className="sticky-col c1">{row.mandal}</td>
                <td className="sticky-col c2">{row.gramPanchayat}</td>
                <td className="sticky-col c3">
                  <SeatCode code={row.sarpanchCode} women={row.sarpanchWomen} />
                </td>
                <td className="sticky-col c4">{row.declaredWardCount ?? "—"}</td>
                {row.wards.map((cell) => (
                  <td key={cell.wardNumber}>
                    {cell.applicable ? (
                      <SeatCode code={cell.missing && !cell.code ? "Not recorded" : cell.code} women={cell.womenReserved} />
                    ) : (
                      <span className="history">Not applicable</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}

function ImportPane({ model, scope }: { model: AppModel; scope: ReturnType<typeof useReservationScope> }): JSX.Element {
  const [session, setSession] = useState<ReservationImportSession | null>(null);
  const [proposals, setProposals] = useState<ReservationMandalProposal[]>([]);
  const [result, setResult] = useState<ReservationCommitResult | null>(null);
  const [noteName, setNoteName] = useState("2026 GP reservation");
  const [step, setStep] = useState(0);

  async function refresh(next: ReservationImportSession): Promise<void> {
    setSession(next);
    if (next.sessionId) {
      const list = await model.api.reservationProposals({ sessionId: next.sessionId });
      setProposals(list);
    }
  }

  async function openFile(): Promise<void> {
    const opened = await model.api.reservationOpen({ constituencyId: model.constituencyId });
    if ("cancelled" in opened) return;
    await refresh(opened);
    setStep(opened.preview ? 1 : 0);
    setResult(null);
  }

  if (!model.constituencyId) {
    return <p className="empty">Select a constituency first.</p>;
  }

  const preview = session?.preview;
  const confirmDisabled = !session || session.eligibleCount === 0 || (session.unresolvedCount > 0 && !session.allowPartial);

  return (
    <div className="grid">
      <div className="steps">
        {["File", "Election", "Preview", "Geography", "Counts", "Confirm"].map((label, i) => (
          <span key={label} className={`chip${i === step ? "" : " muted"}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>
      <article className="card grid">
        <button className="btn" type="button" data-testid="res-import-open" onClick={() => void openFile()}>
          Choose reservation XLSX
        </button>
        {session?.worksheets.some((sheet) => sheet.excluded) ? (
          <p className="banner">PENSION DATA and Sheet5 are excluded and were not parsed.</p>
        ) : null}
        {session && !preview ? (
          <label>
            Worksheet
            <select
              data-testid="res-sheet"
              value={session.selectedSheet ?? ""}
              onChange={(e) => {
                void model.api.reservationSelectSheet({ sessionId: session.sessionId, sheetName: e.target.value }).then(refresh);
                setStep(1);
              }}
            >
              <option value="">Select reservation sheet</option>
              {session.worksheets
                .filter((sheet) => !sheet.excluded)
                .map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {preview ? (
          <>
            <label>
              Election workspace
              <select
                data-testid="res-import-election"
                value={session?.electionId ?? ""}
                onChange={(e) => {
                  if (!session) return;
                  void model.api
                    .reservationSetContext({
                      sessionId: session.sessionId,
                      electionId: e.target.value,
                      notificationName: noteName,
                      year: preview.year ?? undefined
                    })
                    .then((next) => {
                      void refresh(next);
                      setStep(2);
                    });
                }}
              >
                <option value="">Select…</option>
                {scope.elections.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.year})
                  </option>
                ))}
              </select>
            </label>
            <input data-testid="res-note-name" value={noteName} onChange={(e) => setNoteName(e.target.value)} placeholder="Notification name" />
            <p data-testid="res-control-note">{preview.controlNote}</p>
            <p data-testid="res-controls">
              Year {preview.controls.year} · GPs {preview.controls.gramPanchayats} · Tanuku {preview.controls.tanuku} · Attili{" "}
              {preview.controls.attili} · Iragavaram {preview.controls.iragavaram} · Sarpanch {preview.controls.sarpanchReservations} ·
              Declared {preview.controls.declaredWardSeats} · Populated {preview.controls.populatedWardReservations} · Missing{" "}
              {preview.controls.missingReservationCells} · Invalid {preview.controls.invalidReservationCodes}
            </p>
            {preview.controlDiffs.length ? (
              <ul data-testid="res-control-diffs">
                {preview.controlDiffs.map((diff) => (
                  <li key={diff.label}>
                    {diff.label}: workbook {diff.actual}, expected control {diff.expected}
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="res-control-match">Workbook controls match the expected layout counts.</p>
            )}
            <table className="table" data-testid="res-preview-table">
              <thead>
                <tr>
                  <th>Mandal</th>
                  <th>GP</th>
                  <th>Sarpanch</th>
                  <th>Declared</th>
                  <th>Populated</th>
                  <th>Geographic mapping</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row) => {
                  const statuses = [
                    ...new Set(
                      (session?.staged ?? [])
                        .filter((item) => item.draft.sourceRow === row.sourceRow)
                        .map((item) => item.reviewStatus.replaceAll("_", " "))
                    )
                  ];
                  return (
                    <tr key={row.sourceRow}>
                      <td>{row.sourceMandal}</td>
                      <td>{row.sourceGp}</td>
                      <td>{row.sarpanchOriginal || "Not recorded"}</td>
                      <td>{row.declaredWardCount ?? "—"}</td>
                      <td>{row.populatedWardCount}</td>
                      <td>{statuses.join(", ") || "pending"}</td>
                      <td>{row.issues.join(" ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <h3>Mandal mapping review</h3>
            <p>Labels such as Tanuku-1 are proposed as Tanuku. Approve the mapping; suffixes are not created as separate mandals.</p>
            {proposals.map((item) => (
              <div className="row" key={item.proposed}>
                <span>
                  {item.proposed} ← {item.sourceLabels.join(", ")} ({item.gpCount} GPs) · {item.matchStatus}
                </span>
                <select
                  data-testid={`res-mandal-map-${item.proposed}`}
                  defaultValue={item.mandalId ?? ""}
                  onChange={(e) => {
                    if (!session) return;
                    void model.api
                      .reservationApproveMandal({ sessionId: session.sessionId, proposed: item.proposed, mandalId: e.target.value || null })
                      .then(refresh);
                  }}
                >
                  <option value="">Unmatched…</option>
                  {item.candidates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn secondary"
                  type="button"
                  data-testid={`res-approve-${item.proposed}`}
                  onClick={() => {
                    if (!session) return;
                    void model.api
                      .reservationApproveMandal({
                        sessionId: session.sessionId,
                        proposed: item.proposed,
                        mandalId: item.mandalId
                      })
                      .then(refresh);
                    setStep(3);
                  }}
                >
                  Approve {item.proposed}
                </button>
              </div>
            ))}
            {session?.geoPlan && (session.geoPlan.mandals.length || session.geoPlan.gramPanchayats.length || session.geoPlan.wards.length) ? (
              <article className="card grid" data-testid="res-geo-plan">
                <h3>Reviewed creation</h3>
                <p>These units will be created without official codes, village links or constituency coverage.</p>
                <ul>
                  {session.geoPlan.mandals.map((item) => (
                    <li key={item.name}>Mandal {item.name}</li>
                  ))}
                  {session.geoPlan.gramPanchayats.map((item) => (
                    <li key={`${item.mandalName}-${item.name}`}>
                      GP {item.name} in {item.mandalName}
                    </li>
                  ))}
                  {session.geoPlan.wards.map((item) => (
                    <li key={`${item.gpName}-${item.wardNumber}`}>
                      Ward {item.wardNumber} in {item.gpName}
                    </li>
                  ))}
                </ul>
                <button
                  className="btn"
                  type="button"
                  data-testid="res-create-geo"
                  onClick={() => session && void model.api.reservationCreateGeo({ sessionId: session.sessionId, confirm: true }).then(refresh)}
                >
                  Create listed units
                </button>
              </article>
            ) : null}
            <p data-testid="res-eligible">
              Importable {session?.eligibleCount ?? 0} · unresolved {session?.unresolvedCount ?? 0} · excluded {session?.excludedCount ?? 0}
            </p>
            {session && session.eligibleCount === 0 ? (
              <p className="error" data-testid="res-confirm-blocked">
                Nothing can be imported yet. Approve mandal mappings and resolve unmatched geography.
              </p>
            ) : null}
            <label className="row">
              <input
                type="checkbox"
                data-testid="res-partial"
                checked={Boolean(session?.allowPartial)}
                onChange={(e) => session && void model.api.reservationSetPartial({ sessionId: session.sessionId, allowPartial: e.target.checked }).then(refresh)}
              />
              Import mapped records and keep unresolved rows in the review queue
            </label>
            <div className="row">
              <button
                className="btn"
                type="button"
                data-testid="res-commit"
                disabled={confirmDisabled}
                onClick={() => {
                  if (!session) return;
                  void model.api
                    .reservationCommit({ sessionId: session.sessionId, allowPartial: session.allowPartial })
                    .then((next) => {
                      setResult(next);
                      setSession(null);
                      setStep(5);
                    })
                    .catch((err: unknown) => model.setError(err instanceof Error ? err.message : String(err)));
                }}
              >
                Confirm import
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={() => session && void model.api.reservationCancel({ sessionId: session.sessionId }).then(() => setSession(null))}
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}
        {result ? (
          <p data-testid="res-import-summary">
            Imported {result.imported}. Unresolved {result.unresolved}. Excluded {result.excluded}. Conflicting {result.conflicting}.
            Imported records are not marked officially verified.
          </p>
        ) : null}
      </article>
    </div>
  );
}

export function ReservationsPage({ model }: { model: AppModel }): JSX.Element {
  const scope = useReservationScope(model);
  return (
    <section className="grid">
      <h1>Seat Reservations</h1>
      <p className="lede">
        Reservation categories describe seats in a notification. They are not attached to voters or contacts and do not infer caste,
        eligibility or political preference.
      </p>
      <nav className="tabs" aria-label="Reservation views">
        <NavLink end className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/reservations" data-testid="res-tab-summary">
          Summary
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/reservations/sarpanch" data-testid="res-tab-sarpanch">
          Sarpanch Reservations
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/reservations/wards" data-testid="res-tab-wards">
          Ward Member Reservations
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/reservations/matrix" data-testid="res-tab-matrix">
          GP Reservation Matrix
        </NavLink>
        <NavLink className={({ isActive }) => `tab${isActive ? " active" : ""}`} to="/reservations/import" data-testid="res-tab-import">
          Import and Review
        </NavLink>
      </nav>
      <ScopeFilters model={model} scope={scope} />
      <Routes>
        <Route path="/" element={<SummaryPane model={model} scope={scope} />} />
        <Route path="sarpanch" element={<SeatList model={model} scope={scope} seatType="sarpanch" />} />
        <Route path="wards" element={<SeatList model={model} scope={scope} seatType="ward_member" />} />
        <Route path="matrix" element={<MatrixPane model={model} scope={scope} />} />
        <Route path="import" element={<ImportPane model={model} scope={scope} />} />
      </Routes>
    </section>
  );
}

export function ReservationUnitCard({
  model,
  gramPanchayatId,
  wardId
}: {
  model: AppModel;
  gramPanchayatId?: string;
  wardId?: string;
}): JSX.Element {
  const [elections, setElections] = useState<ElectionWorkspace[]>([]);
  const [electionId, setElectionId] = useState("");
  const [seats, setSeats] = useState<ReservationSeat[]>([]);
  useEffect(() => {
    if (!model.constituencyId) return;
    model.api.electionList({ constituencyId: model.constituencyId }).then(setElections).catch(() => undefined);
  }, [model.api, model.constituencyId]);
  useEffect(() => {
    if (!model.constituencyId || !electionId) {
      setSeats([]);
      return;
    }
    model.api
      .reservationForUnit({ constituencyId: model.constituencyId, electionId, gramPanchayatId, wardId })
      .then(setSeats)
      .catch(() => setSeats([]));
  }, [model.api, model.constituencyId, electionId, gramPanchayatId, wardId]);

  return (
    <article className="card grid" data-testid="res-unit-card">
      <h2>Seat reservations</h2>
      <label>
        Election context
        <select data-testid="res-unit-election" value={electionId} onChange={(e) => setElectionId(e.target.value)}>
          <option value="">Select an election…</option>
          {elections.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} ({row.year})
            </option>
          ))}
        </select>
      </label>
      {!electionId ? (
        <p className="empty">Select an election workspace to see reservation information. Nothing is treated as permanently current.</p>
      ) : seats.length === 0 ? (
        <p className="empty">No reservation records for this unit in the selected election notification.</p>
      ) : (
        <ul>
          {seats.map((seat) => (
            <li key={seat.id}>
              {seat.seatType === "sarpanch" ? "Sarpanch" : `Ward ${seat.sourceWardNumber}`}: {seat.originalCode || seat.category} ·{" "}
              {seat.womenReserved ? "Women-reserved" : "Not specifically reserved for women"}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
