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
- Versioned migrations in `src/main/db/schema.ts` (currently schema 3; Phase 1 uses v1 geography/elections plus unused later tables that do not affect the UI)
- Portable backup container `WWINBAK1` + manifest + SQLite bytes (`.winwinbak`)
- **Not encrypted**

## Geography

Administrative units are independent of constituencies. `constituency_coverage` maps units with `complete` or `partial`. Partial never implies children.

Wards belong to a boundary version. Unique ward numbers are scoped to parent local body + boundary version.

Elections pin a boundary version and store name snapshots; archived workspaces cannot be edited.

Phase 2 ward workspace stores people separately from ward contact links, team assignments, issues (with status history) and tasks. Writes require the ward to be in the selected constituency coverage. Audit logs field names only.
