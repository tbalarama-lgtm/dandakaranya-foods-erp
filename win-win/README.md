# WIN WIN

Offline desktop application for Assembly constituency and local-body election administration (ward-level). Phase 1: geography, election workspaces, dashboard, settings, audit, backup/restore.

The database and backups are **not encrypted**. An application password is not used and would not be equivalent to encryption.

This is not an electronic ballot or official result-certification system.

## Requirements

- Node.js 20+ (this project was developed with Node 22)
- Windows 10/11 x64 **or** macOS (Apple Silicon or Intel), for running the packaged app
- Linux can be used for development, tests and production JS builds

## Install (any desktop OS)

```bash
cd win-win
npm install
```

`postinstall` rebuilds `better-sqlite3` for Electron via `electron-builder install-app-deps`.

`better-sqlite3` is a native module. `npm install` rebuilds it for **Electron**. Automated tests run in **Node**, so `npm test` rebuilds the module for the current Node.js ABI first. After tests, rebuild for Electron before `npm run dev`:

```bash
npm run rebuild:native
```

## Develop

**Windows**

```bat
cd win-win
npm install
npm run dev
```

**macOS / Linux**

```bash
cd win-win
npm install
npm run dev
```

The app stores data in Electron `userData` (not the install folder):

- Windows: `%APPDATA%\WIN WIN\win-win-data\`
- macOS: `~/Library/Application Support/WIN WIN/win-win-data/`
- Linux: `~/.config/WIN WIN/win-win-data/`

## Checks

```bash
cd win-win
npm run typecheck
npm test
npm run build
```

## Production JS build

```bash
cd win-win
npm run build
```

Outputs `out/main`, `out/preload`, `out/renderer`.

## Windows installer (run on Windows x64)

Unsigned development package (no signing credentials required):

```bat
cd win-win
npm install
npm run dist:win
```

Installer appears under `win-win/release/` as `WIN-WIN-Setup-1.0.0-windows-x64.exe`.

Signed distribution: set Windows Authenticode credentials (`CSC_LINK` / `CSC_KEY_PASSWORD` or Azure SignTool) and remove `signAndEditExecutable: false` / `forceCodeSigning: false` in `electron-builder.yml`. This repository does not include certificates.

## macOS DMG (run on macOS)

Unsigned development package (`mac.identity` is `null`):

```bash
cd win-win
npm install
npm run dist:mac
```

Apple Silicon and Intel DMGs are requested via electron-builder (`arm64` and `x64`).

Signed + notarized distribution requires an Apple Developer ID, hardened runtime entitlements, and notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Local development does not require those credentials. Unsigned builds will be Gatekeeper-blocked until the user allows them.

Do not treat a Linux-produced artifact as a tested Windows or macOS installer.

## Backup and restore

Use **Backup** in the app. Files use the portable `.winwinbak` format (UTF-8, no OS-specific paths). Copy the file to another computer and restore there. That is a **manual transfer**, not live sync.

Restore validates application identity, SQLite integrity and schema compatibility, keeps a recovery copy, and reinstates it if replacement fails.

## Demo data

The database starts empty. Settings can load labelled `[DEMO]` records only into an empty workspace.

## Phase 2 (not in this build)

Voter rolls and CSV/XLSX import, ward contacts, team, issues, tasks, documents, reports.
