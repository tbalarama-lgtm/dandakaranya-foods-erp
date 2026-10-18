import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  ImportColumnMapping,
  ImportCommitResult,
  ImportPreview,
  ImportValidateResult,
  RollEdition,
  StagedImportRow,
  WardListItem
} from "@shared/types";
import type { AppModel } from "../App";

const STEPS = ["File", "Sheet", "Edition", "Map", "Preview", "Validate", "Confirm"];
const MAP_FIELDS: Array<{ key: keyof ImportColumnMapping; label: string; requiredHint: string }> = [
  { key: "nameOriginal", label: "Name (original script)", requiredHint: "Needed if identifier is blank" },
  { key: "nameEnglish", label: "English name", requiredHint: "Optional" },
  { key: "electoralId", label: "Electoral identifier", requiredHint: "Text only; numeric Excel cells need review" },
  { key: "rollSerial", label: "Roll serial", requiredHint: "Optional; not a unique id" },
  { key: "publishedAge", label: "Published age", requiredHint: "Optional; not converted to a birth date" },
  { key: "ageReferenceDate", label: "Age reference date", requiredHint: "Optional" },
  { key: "publishedAddress", label: "Published address", requiredHint: "Optional" },
  { key: "wardNumber", label: "Ward number", requiredHint: "Mapped explicitly; never inferred from address" },
  { key: "sourceSection", label: "Source section", requiredHint: "Traceability only" },
  { key: "sourcePage", label: "Source page", requiredHint: "Traceability only" }
];

export function ImportPage({ model }: { model: AppModel }): JSX.Element {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [editions, setEditions] = useState<RollEdition[]>([]);
  const [editionId, setEditionId] = useState("");
  const [editionName, setEditionName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMappingState] = useState<ImportColumnMapping>({});
  const [validated, setValidated] = useState<ImportValidateResult | null>(null);
  const [reviewRows, setReviewRows] = useState<StagedImportRow[]>([]);
  const [identifierRows, setIdentifierRows] = useState<StagedImportRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [wardId, setWardId] = useState("");
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [acknowledgeRepeat, setAcknowledgeRepeat] = useState(false);
  const [correction, setCorrection] = useState("");

  const sessionId = preview?.sessionId;

  useEffect(() => {
    return model.api.onImportProgress((next) => {
      setProgress(`${next.message} ${next.processed}/${next.total}`);
    });
  }, [model.api]);

  async function loadEditions(): Promise<RollEdition[]> {
    const next = await model.api.editionList({ constituencyId: model.constituencyId, includeArchived: false });
    setEditions(next);
    return next;
  }

  async function loadReview(id: string, summary: ImportValidateResult): Promise<void> {
    setValidated(summary);
    const [review, identifiers] = await Promise.all([
      model.api.importListStaged({ sessionId: id, kind: "review", page: 1, pageSize: 50 }),
      model.api.importListStaged({ sessionId: id, kind: "identifier", page: 1, pageSize: 50 })
    ]);
    setReviewRows(review.items);
    setIdentifierRows(identifiers.items);
  }

  async function chooseFile(): Promise<void> {
    if (!model.constituencyId) {
      model.setError("Select a constituency first.");
      return;
    }
    setProgress("Reading file locally…");
    try {
      const opened = await model.api.importOpen({ constituencyId: model.constituencyId });
      if ("cancelled" in opened && opened.cancelled) {
        setProgress("");
        return;
      }
      setPreview(opened);
      setMappingState(opened.suggestedMapping);
      setValidated(null);
      setResult(null);
      setSheetName(opened.selectedSheet ?? "");
      await loadEditions();
      if (model.boundaryVersionId) {
        const page = await model.api.wardList({
          constituencyId: model.constituencyId,
          boundaryVersionId: model.boundaryVersionId,
          page: 1,
          pageSize: 200
        });
        setWards(page.items);
      }
      setStep(opened.needsSheetSelection ? 1 : 2);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress("");
    }
  }

  async function applySheet(): Promise<void> {
    if (!sessionId || !sheetName) return;
    setProgress("Reading selected worksheet…");
    try {
      const next = await model.api.importSelectSheet({ sessionId, sheetName });
      setPreview(next);
      setMappingState(next.suggestedMapping);
      setStep(2);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress("");
    }
  }

  async function applyEdition(): Promise<void> {
    if (!sessionId || !editionId) return;
    setProgress("Checking edition and previous imports…");
    try {
      const next = await model.api.importSetEdition({ sessionId, rollEditionId: editionId });
      setPreview(next);
      setStep(3);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress("");
    }
  }

  async function applyMapping(): Promise<void> {
    if (!sessionId) return;
    const next = await model.api.importSetMapping({ sessionId, mapping });
    setMappingState(next);
    setStep(4);
  }

  async function runValidate(): Promise<void> {
    if (!sessionId) return;
    setProgress(`Validating ${preview?.rowCount ?? 0} rows…`);
    try {
      const next = await model.api.importValidate({ sessionId });
      await loadReview(sessionId, next);
      setStep(5);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress("");
    }
  }

  async function assignSelected(keepUnassigned = false): Promise<void> {
    if (!sessionId || selectedRows.length === 0) return;
    const next = await model.api.importAssignStaged({
      sessionId,
      sourceRowNumbers: selectedRows,
      wardId: keepUnassigned ? null : wardId || null
    });
    await loadReview(sessionId, next);
    setSelectedRows([]);
  }

  async function reviewSelected(action: "accept-raw" | "correct"): Promise<void> {
    if (!sessionId || identifierRows.length === 0) return;
    const targets = identifierRows.filter((row) => selectedRows.includes(row.sourceRowNumber));
    const rows = (targets.length ? targets : identifierRows).flatMap((row) =>
      Object.keys(row.cellMeta).map((field) => ({
        sourceRowNumber: row.sourceRowNumber,
        field: field as "electoralId" | "rollSerial" | "wardNumber",
        action,
        value: action === "correct" ? correction : undefined
      }))
    );
    const next = await model.api.importReviewIdentifiers({ sessionId, items: rows });
    await loadReview(sessionId, next);
    setCorrection("");
    setSelectedRows([]);
  }

  async function commit(): Promise<void> {
    if (!sessionId) return;
    setProgress("Committing import atomically…");
    try {
      const next = await model.api.importCommit({ sessionId, acknowledgeRepeat });
      setResult(next);
      setStep(7);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress("");
    }
  }

  async function cancel(): Promise<void> {
    if (sessionId) await model.api.importCancel({ sessionId });
    setPreview(null);
    setValidated(null);
    setResult(null);
    setStep(0);
    setProgress("");
  }

  if (!model.constituencyId) {
    return (
      <div className="card empty">
        <h2>Select a constituency</h2>
        <p>Imports stay inside the selected constituency.</p>
      </div>
    );
  }

  return (
    <section className="grid">
      <h1>Import electoral roll</h1>
      <p>
        CSV/XLSX only, processed on this computer. Numeric Excel identifiers are not treated as original text. Limit: 20 MB
        and 50,000 data rows.
      </p>
      <div className="steps" data-testid="import-steps">
        {STEPS.map((label, index) => (
          <span key={label} className={`chip${index === Math.min(step, 6) ? "" : " muted"}`}>
            {index + 1}. {label}
          </span>
        ))}
      </div>
      {progress ? (
        <p className="banner" data-testid="import-progress">
          {progress}
        </p>
      ) : null}
      {step === 0 || !preview ? (
        <article className="card grid">
          <button className="btn" type="button" data-testid="import-choose" onClick={() => void chooseFile()}>
            Choose CSV or XLSX
          </button>
          <div className="row">
            <button className="btn secondary" type="button" onClick={() => void model.api.importTemplate({ format: "csv" })}>
              Download CSV template
            </button>
            <button className="btn secondary" type="button" onClick={() => void model.api.importTemplate({ format: "xlsx" })}>
              Download XLSX template
            </button>
          </div>
        </article>
      ) : null}
      {preview && step >= 1 && step < 7 ? (
        <article className="card grid">
          <p>
            File <strong data-testid="import-filename">{preview.fileName}</strong>
            {preview.selectedSheet ? ` · sheet ${preview.selectedSheet}` : ""} · {preview.rowCount} data rows
            {preview.formulaCellCount ? ` · ${preview.formulaCellCount} formula cells` : ""}
            {preview.numericCoercionCount ? ` · ${preview.numericCoercionCount} numeric cells` : ""}
          </p>
          {preview.headerWarnings.map((warning) => (
            <p className="error" key={warning}>
              {warning}
            </p>
          ))}
          {preview.repeatedImport ? (
            <p className="error" data-testid="import-repeat">
              This file fingerprint was already committed to the selected roll edition.
            </p>
          ) : null}
          {preview.repeatedInOtherEditions ? (
            <p className="banner" data-testid="import-repeat-other">
              This file was imported into another roll edition. That is a revision, not an automatic duplicate of this edition.
            </p>
          ) : null}
          {step === 1 ? (
            <>
              <label>
                Worksheet
                <select id="import-sheet" data-testid="import-sheet" value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
                  <option value="">Select…</option>
                  {preview.worksheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                      {sheet.hidden ? " (hidden)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <button className="btn" type="button" data-testid="import-sheet-next" disabled={!sheetName} onClick={() => void applySheet()}>
                  Read worksheet
                </button>
                <button className="btn secondary" type="button" data-testid="import-cancel" onClick={() => void cancel()}>
                  Cancel import
                </button>
              </div>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label>
                Roll edition
                <select id="import-edition" data-testid="import-edition" value={editionId} onChange={(e) => setEditionId(e.target.value)}>
                  <option value="">Select…</option>
                  {editions.map((edition) => (
                    <option key={edition.id} value={edition.id}>
                      {edition.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <input
                  id="import-edition-name"
                  data-testid="import-edition-name"
                  placeholder="New edition name"
                  value={editionName}
                  onChange={(e) => setEditionName(e.target.value)}
                />
                <button
                  className="btn secondary"
                  type="button"
                  data-testid="import-edition-create"
                  onClick={async () => {
                    if (!model.boundaryVersionId || !editionName.trim()) return;
                    const created = await model.api.editionCreate({
                      constituencyId: model.constituencyId,
                      boundaryVersionId: model.boundaryVersionId,
                      name: editionName
                    });
                    setEditionName("");
                    await loadEditions();
                    setEditionId(created.id);
                  }}
                >
                  Create edition
                </button>
              </div>
              <div className="row">
                <button className="btn" type="button" data-testid="import-edition-next" disabled={!editionId} onClick={() => void applyEdition()}>
                  Continue
                </button>
                <button className="btn secondary" type="button" data-testid="import-cancel" onClick={() => void cancel()}>
                  Cancel import
                </button>
              </div>
            </>
          ) : null}
          {step === 3 ? (
            <>
              {MAP_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <select
                    data-testid={`map-${field.key}`}
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMappingState({ ...mapping, [field.key]: e.target.value || undefined })}
                  >
                    <option value="">Not in this file</option>
                    {preview.columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                  <span className="history">{field.requiredHint}</span>
                </label>
              ))}
              <button className="btn" type="button" data-testid="import-map-next" onClick={() => void applyMapping()}>
                Continue
              </button>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <table className="table" data-testid="import-preview-table">
                <thead>
                  <tr>
                    {preview.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(preview.previewCells.length ? preview.previewCells : preview.previewRows.map((row) => row.map((text) => ({ text })))).map(
                    (row, i) => (
                      <tr key={i}>
                        {preview.columns.map((_, j) => {
                          const cell = row[j] as
                            | { text?: string; type?: string; raw?: string; displayed?: string; originalTextEstablished?: boolean }
                            | undefined;
                          return (
                            <td key={j} data-cell-type={cell?.type ?? "text"}>
                              <div>{cell?.text ?? ""}</div>
                              {cell?.type && cell.type !== "text" && cell.type !== "empty" ? (
                                <div className="history">
                                  type {cell.type}; raw {cell.raw}; displayed {cell.displayed}
                                  {cell.originalTextEstablished === false ? "; original text not established" : ""}
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <button className="btn" type="button" data-testid="import-preview-next" onClick={() => void runValidate()}>
                Validate
              </button>
            </>
          ) : null}
          {step >= 5 && validated && step < 7 ? (
            <>
              <p data-testid="import-validate-summary">
                Eligible {validated.eligibleCount} · unassigned {validated.unassignedCount} · rejected {validated.rejectedCount} ·
                identifier review {validated.identifierReviewCount} · empty skipped {validated.emptySkipped} · mapped{" "}
                {validated.assignedCount} · issues {validated.errorCount}
              </p>
              <div className="row">
                <button
                  className="btn secondary"
                  type="button"
                  data-testid="import-error-report"
                  onClick={() => void model.api.importErrorReport({ sessionId })}
                >
                  Export error report
                </button>
              </div>
              {identifierRows.length > 0 ? (
                <article className="card grid" data-testid="identifier-review">
                  <h3>Numeric identifier review</h3>
                  <p>WIN WIN will not invent missing zeros. Accept the raw stored number or type the exact source text.</p>
                  <table className="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Row</th>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Raw</th>
                        <th>Displayed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {identifierRows.map((row) =>
                        Object.entries(row.cellMeta).map(([field, meta]) => (
                          <tr key={`${row.sourceRowNumber}-${field}`}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedRows.includes(row.sourceRowNumber)}
                                onChange={(e) =>
                                  setSelectedRows((current) =>
                                    e.target.checked
                                      ? [...current, row.sourceRowNumber]
                                      : current.filter((n) => n !== row.sourceRowNumber)
                                  )
                                }
                              />
                            </td>
                            <td>{row.sourceRowNumber}</td>
                            <td>{field}</td>
                            <td>{meta.type}</td>
                            <td>{meta.raw}</td>
                            <td>{meta.displayed}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="row">
                    <input
                      data-testid="identifier-correction"
                      placeholder="Exact source text"
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                    />
                    <button className="btn" type="button" data-testid="identifier-accept-raw" onClick={() => void reviewSelected("accept-raw")}>
                      Accept raw values
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      data-testid="identifier-correct"
                      disabled={!correction.trim()}
                      onClick={() => void reviewSelected("correct")}
                    >
                      Save correction
                    </button>
                  </div>
                </article>
              ) : null}
              <table className="table" data-testid="import-review-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Row</th>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Ward</th>
                    <th>Match</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((row) => (
                    <tr key={row.sourceRowNumber}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.sourceRowNumber)}
                          onChange={(e) =>
                            setSelectedRows((current) =>
                              e.target.checked ? [...current, row.sourceRowNumber] : current.filter((n) => n !== row.sourceRowNumber)
                            )
                          }
                        />
                      </td>
                      <td>{row.sourceRowNumber}</td>
                      <td>{row.values.nameOriginal}</td>
                      <td>{row.values.electoralId}</td>
                      <td>{row.values.wardNumber || "—"}</td>
                      <td>{row.wardMatch}</td>
                      <td>{row.errors.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row">
                <select data-testid="import-ward" value={wardId} onChange={(e) => setWardId(e.target.value)}>
                  <option value="">Ward…</option>
                  {wards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.wardNumber} — {ward.name}
                    </option>
                  ))}
                </select>
                <button className="btn" type="button" data-testid="import-assign" disabled={!wardId || selectedRows.length === 0} onClick={() => void assignSelected(false)}>
                  Assign selected
                </button>
                <button className="btn secondary" type="button" data-testid="import-keep-unassigned" disabled={selectedRows.length === 0} onClick={() => void assignSelected(true)}>
                  Keep unassigned
                </button>
              </div>
              {preview.repeatedImport ? (
                <label className="row">
                  <input type="checkbox" data-testid="import-ack-repeat" checked={acknowledgeRepeat} onChange={(e) => setAcknowledgeRepeat(e.target.checked)} />
                  Import these rows again into the same edition
                </label>
              ) : null}
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  data-testid="import-commit"
                  disabled={validated.identifierReviewCount > 0}
                  onClick={() => void commit()}
                >
                  Confirm import
                </button>
                <button className="btn danger" type="button" data-testid="import-cancel" onClick={() => void cancel()}>
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </article>
      ) : null}
      {result ? (
        <article className="card grid" data-testid="import-summary">
          <h2>Import complete</h2>
          <p data-testid="import-summary-counts">
            Imported {result.imported}. Unassigned {result.unassigned}. Rejected {result.rejected}. Duplicate flags{" "}
            {result.flaggedDuplicates}.
          </p>
          <Link className="btn" to="/voters">
            Open voter directory
          </Link>
        </article>
      ) : null}
    </section>
  );
}
