# WIN WIN

Offline desktop application for Assembly constituency and local-body election administration (ward-level). Phase 1: geography, election workspaces, dashboard, settings, audit, backup/restore.

The database and backups are **not encrypted**. An application password is not used and would not be equivalent to encryption.

This is not an electronic ballot or official result-certification system.

## Windows / macOS quick start

### Prerequisites

- Node.js 20 or newer (developed with Node 22)
- Windows 10/11 x64, or macOS (Apple Silicon or Intel)
- For installers: run the packager **on the target OS** (`dist:win` on Windows, `dist:mac` on macOS)

### Install

```bat
cd win-win
npm install
```

`postinstall` rebuilds `better-sqlite3` for **Electron** (`electron-builder install-app-deps`).

### Launch

```bat
npm run dev
```

Sandbox stays enabled. Do not add `--no-sandbox` on Windows or macOS.

Linux development: Chromium may refuse to start if the sandbox cannot be configured. That is an environment-specific test workaround only:

```bash
WINWIN_LINUX_NO_SANDBOX=1 npm run test:ui-profile
```

Do not use `--no-sandbox` as a production default.

### Build installer

Windows (run on Windows x64):

```bat
cd win-win
npm install
npm run dist:win
```

Output: `win-win/release/WIN-WIN-Setup-1.0.0-windows-x64.exe` (unsigned).

macOS (run on macOS):

```bash
cd win-win
npm install
npm run dist:mac
```

Output: `win-win/release/WIN-WIN-1.0.0-macos-arm64.dmg` and `…-x64.dmg` (unsigned; `mac.identity` is `null`).

A Linux machine can typecheck, test, and compile the JS bundle. It cannot prove that a Windows or macOS installer works.

### Data location

User data is **outside** the application folder (Electron `userData`):

| OS | Packaged app | Unpackaged `npm run dev` |
| --- | --- | --- |
| Windows | `%APPDATA%\WIN WIN\win-win-data\` | `%APPDATA%\win-win\win-win-data\` |
| macOS | `~/Library/Application Support/WIN WIN/win-win-data/` | `~/Library/Application Support/win-win/win-win-data/` |
| Linux | `~/.config/WIN WIN/win-win-data/` | `~/.config/win-win/win-win-data/` |

Database file: `win-win.sqlite`. Uninstallers do not delete this folder (`deleteAppDataOnUninstall: false`).

### Backup and restore

1. Open **Backup**.
2. **Create backup** writes a portable `.winwinbak` file (default folder: `win-win-data/backups/`).
3. Copy that file to another computer if needed. That is a **manual transfer**, not live sync.
4. **Restore from file** validates identity, SQLite integrity and schema, keeps a recovery copy, and reinstates it if replacement fails.

The live database file cannot be chosen as a backup destination.

## Native module ABI (tests vs Electron)

`better-sqlite3` must match the process that loads it.

| Command | ABI |
| --- | --- |
| `npm install` / `npm run rebuild:electron` / `npm run dev` / packaging | Electron |
| `npm test` | Node for Vitest, then **always** restores Electron |
| `npm run rebuild:node` | Node only (leaves Electron broken until you restore) |

`npm test` is `node scripts/run-tests.mjs`. It rebuilds for Node, runs Vitest, then runs `electron-builder install-app-deps` even when tests fail. Do not chain `&&` rebuilds in the shell; the Node scripts work on Windows and macOS.

```bat
npm run typecheck
npm test
npm run build
```

`npm run test:watch` does **not** restore Electron. After a watch session:

```bat
npm run rebuild:electron
```

Isolated UI profile (does not touch the normal database):

```bat
npm run build
npm run test:ui-profile
```

## Production JS build

```bat
npm run build
```

Outputs `out/main`, `out/preload` (`index.cjs`), `out/renderer`. Packaging includes those plus production Node modules. Native `.node` files are unpacked from asar (`better-sqlite3`). Schema migrations ship inside the main process bundle (`src/main/db/schema.ts` compiled to `out/main`).

Startup entry: `out/main/index.js` (`package.json` `main` and `electron-builder.yml` `extraMetadata.main`).

## Signing

- Windows: this repo sets `signAndEditExecutable: false` / `forceCodeSigning: false`. Add Authenticode credentials for a signed build.
- macOS: unsigned DMGs are Gatekeeper-blocked until allowed. Notarization needs an Apple Developer ID.

## Demo data

The database starts empty. Settings can load labelled `[DEMO]` records only into an empty workspace.

## Phase 2 ward workspace

Each rural and urban ward opens a workspace: **Overview | Contacts | Team | Issues | Tasks**. Contacts separate person identity from ward associations. Phone and email require recorded consent. Team assignment history is kept. Issues have dated status history. Tasks calculate overdue dates with the local calendar.

## Phase 3 electoral roll

Voters and Import screens store authorized roll editions, CSV/XLSX batches, electoral-roll entries, and ward assignment history. Person/contact records stay separate and are never linked by name or phone.

Import limits: 20 MB file size and 50,000 data rows. Identifiers stay text (including leading zeros). Formula cells are not executed. PDF/OCR, messaging and documents are later phases.

Isolated voter UI profile:

```bat
npm run build
npm run test:ui-voters
```
