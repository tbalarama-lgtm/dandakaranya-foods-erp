# Phase 1 validation (this environment)

Date: 2026-10-18. Host: Linux x64, Node v22.14.0.

## Commands

| Command | Result |
|---|---|
| `cd win-win && npm install` | Succeeded (645 packages). `postinstall` rebuilt `better-sqlite3` for Electron. |
| `npm run typecheck` | Succeeded (`tsconfig.node.json` and `tsconfig.web.json`). |
| `npm run rebuild:node && npx vitest run` | 11/11 tests passed after ABI rebuild for Node. |
| `npx @electron/rebuild -f -w better-sqlite3` then `npm run build` | Succeeded: `out/main/index.js`, `out/preload/index.cjs`, `out/renderer`. |
| `npx electron . --no-sandbox` on `DISPLAY=:1` | Window titled **WIN WIN** opened. First preload (ESM) failed IPC; CJS preload then loaded the shell, empty dashboard, Backup and Settings screens. |
| Windows NSIS / macOS DMG | **Not built. Not tested.** Linux only. |

## Automated tests

Geographic parents, village-to-ward mapping, partial coverage (no silent complete expansion), constituency isolation of dashboard counts, Telugu search via parent name, archived election snapshots, persistence after reopen, backup/restore, invalid backup rejection, restore-failure recovery, refuse backup onto the live database file.

## UI smoke (Linux)

- Navy sidebar, WIN WIN branding, mint buttons.
- Empty-state dashboard when no constituency exists.
- Settings shows version 1.0.0, schema 3, data path under userData, unencrypted notice, audit viewer empty, demo loader disabled-looking until empty workspace.
- Backup screen explains portable `.winwinbak` and manual transfer.

GPU/D-Bus warnings appeared; they did not block the window. This is not Windows or macOS runtime verification.

## Native module note

`better-sqlite3` must match the process ABI: Node for `npm test`, Electron for `npm run dev` / packaged apps. Use `npm run rebuild:node` vs `npm run rebuild:native`.
