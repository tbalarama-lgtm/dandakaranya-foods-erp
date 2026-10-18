import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ImportColumnMapping, ImportCommitResult, ImportPreview, ImportValidateResult, RollEdition, StagedImportRow, WardListItem } from "@shared/types";
import type { AppModel } from "../App";

const STEPS = ["File", "Edition", "Map", "Preview", "Validate", "Wards", "Confirm"];
const MAP_FIELDS: Array<{ key: keyof ImportColumnMapping; label: string; requiredHint: string }> = [
  { key: "nameOriginal", label: "Name (original script)", requiredHint: "Needed if identifier is blank" },
  { key: "nameEnglish", label: "English name", requiredHint: "Optional" },
  { key: "electoralId", label: "Electoral identifier", requiredHint: "Needed if name is blank; keep leading zeros" },
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
  const [mapping, setMappingState] = useState<ImportColumnMapping>({});
  const [validated, setValidated] = useState<ImportValidateResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [wardId, setWardId] = useState("");
  const [wards, setWards] = useState<WardListItem[]>([]);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [acknowledgeRepeat, setAcknowledgeRepeat] = useState(false);

  const sessionId = preview?.sessionId;

  async function loadEditions(): Promise<RollEdition[]> {
    const next = await model.api.editionList({ constituencyId: model.constituencyId, includeArchived: false });
    setEditions(next);
    return next;
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
      setStep(1);
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
      setStep(2);
    } catch (err) {
      model.setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress("");
    }
  }

  async function applyMapping(): Promise<void> {
    if (!sessionId) return;
    await model.api.importSetMapping({ sessionId, mapping });
    setStep(3);
  }

  async function runValidate(): Promise<void> {
    if (!sessionId) return;
    setProgress(`Validating ${preview?.rowCount ?? 0} rows…`);
    try {
      const next = await model.api.importValidate({ sessionId });
      setValidated(next);
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
    setValidated(next);
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
  }

  const reviewRows: StagedImportRow[] = useMemo(
    () => (validated?.rows ?? []).filter((row) => row.wardMatch !== "assigned" || row.errors.length > 0),
    [validated]
  );

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
      <p>CSV/XLSX only, processed on this computer. PDF/OCR, macros and network lookups are not used. Limit: 20 MB and 50,000 data rows.</p>
      <div className="steps" data-testid="import-steps">
        {STEPS.map((label, index) => (
          <span key={label} className={`chip${index === Math.min(step, 6) ? "" : " muted"}`}>
            {index + 1}. {label}
          </span>
        ))}
      </div>
      {progress ? <p className="banner" data-testid="import-progress">{progress}</p> : null}
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
            File <strong data-testid="import-filename">{preview.fileName}</strong> · {preview.rowCount} data rows
            {preview.formulaCellCount ? ` · ${preview.formulaCellCount} formula cells` : ""}
            {preview.numericCoercionCount ? ` · ${preview.numericCoercionCount} numeric cells (leading zeros may be lost)` : ""}
          </p>
          {preview.repeatedImport ? (
            <p className="error" data-testid="import-repeat">
              This file fingerprint was already committed to the selected roll edition.
            </p>
          ) : null}
          {step === 1 ? (
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
                    const list = await loadEditions();
                    setEditionId(created.id || list[0]?.id || "");
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
                <button className="btn secondary" type="button" onClick={() => void cancel()}>
                  Cancel import
                </button>
              </div>
            </>
          ) : null}
          {step === 2 ? (
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
          {step === 3 ? (
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
                  {preview.previewRows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map((_, j) => (
                        <td key={j}>{row[j]}</td>
                      ))}
                    </tr>
                  ))}
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
                {validated.errorCount} issues · {validated.assignedCount} mapped · {validated.unassignedCount} unassigned ·{" "}
                {validated.ambiguousCount} ambiguous/invalid
              </p>
              {validated.issues.length > 0 ? (
                <div className="row">
                  <button
                    className="btn secondary"
                    type="button"
                    data-testid="import-error-report"
                    onClick={() => void model.api.importErrorReport({ issues: validated.issues })}
                  >
                    Export error report
                  </button>
                </div>
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
                <button className="btn" type="button" data-testid="import-commit" onClick={() => void commit()}>
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
          <p>
            Saved {result.imported} rows from this file. Unassigned: {result.unassigned}. Duplicate flags in this edition:{" "}
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
