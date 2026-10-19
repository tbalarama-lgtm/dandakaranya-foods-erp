# WIN WIN architecture (Phase 1)

## Processes

- **Main:** Electron, SQLite (`better-sqlite3`), IPC handlers, file dialogs, backups.
- **Preload:** `contextBridge` exposes `window.winwin` only. No generic `invoke`.
- **Renderer:** React + HashRouter. No Node, no SQL, no filesystem.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- IPC sender URL allow-list
- Zod validation on every channel
- Navigation and `window.open` restricted
- CSP (stricter in production)

## Data

- SQLite in `app.getPath('userData')/win-win-data/win-win.sqlite`
- Foreign keys on every connection
- Versioned migrations in `src/main/db/schema.ts` (currently schema 5). Geography, workspace, and electoral-roll tables coexist; opening an older database applies forward migrations only.
- Portable backup container `WWINBAK1` + manifest + SQLite bytes (`.winwinbak`)
- **Not encrypted**

## Geography

Administrative units are independent of constituencies. `constituency_coverage` maps units with `complete` or `partial`. Partial never implies children.

Wards belong to a boundary version. Unique ward numbers are scoped to parent local body + boundary version.

Elections pin a boundary version and store name snapshots; archived workspaces cannot be edited.

Phase 2 ward workspace stores people separately from ward contact links, team assignments, issues (with status history) and tasks. Writes require the ward to be in the selected constituency coverage. Audit logs field names only.

Phase 3 stores authorized electoral-roll entries separately from person/contact identities. Imports are local CSV/XLSX (20 MB / 50,000 rows). Duplicate/blank headers are renamed with warnings. UTF-8 BOM, Telugu and multiline CSV fields are supported. Interior empty rows are skipped at commit but keep source row numbers. Formula cells are not executed; cached results appear in preview. Workbooks with more than one worksheet require an explicit sheet choice before mapping. Numeric Excel identifier cells (electoral id, roll serial, ward/geo codes) are never treated as original text and are never padded. Review stores `source_*` separately from `local_*` corrections. Repeated fingerprints warn inside the same edition and are allowed as a later revision in another edition. Ward assignment is explicit; invalid/ambiguous numbers do not guess. Duplicate flags never merge records. Counts are per roll edition and must reconcile assigned + unassigned + archived. Import parse/validate yield every 250 rows; commit is a single SQLite transaction (cancel before the transaction starts). Staged rows are listed in pages so the renderer is not given 50,000 rows at once. Audit logs field names only — not voter details. PDF/OCR and messaging are not in this phase.
