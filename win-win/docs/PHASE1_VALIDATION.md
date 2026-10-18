# Phase 1 validation (this environment)

Date: 2026-10-18. Host: Linux x64, Node v22.14.0, Electron 33.4.11.

## Commands

| Command | Result |
|---|---|
| `cd win-win && npm run typecheck` | Succeeded |
| `npm test` | 11/11 tests passed. Node ABI rebuild, then Electron ABI restore (`@electron/rebuild --force` plus `install-app-deps`) |
| `npm run build` | Succeeded: `out/main/index.js`, `out/preload/index.cjs`, `out/renderer` |
| Isolated UI journey `node scripts/ui-journey.mjs` | Succeeded against `/tmp/win-win-ui-test-run/profile`. Default `~/.config/win-win` was not written |
| Windows NSIS / macOS DMG | **Not built. Not tested.** Linux only |

## UI journeys exercised (real window, isolated profile)

Labelled `[TEST-UI]` records:

- Create + select constituency and boundary version
- Mandal (complete coverage), Gram Panchayat, village, rural ward, village–ward mapping, breadcrumb
- Second mandal with **partial** coverage (child GP not implied)
- Urban local body (partial) + urban ward; map urban ward **complete** via named coverage dropdowns
- Ward directory rural/urban filters and search
- Election workspace create + archive
- Dashboard counts: mandals 2, GPs 1, villages 1, ULBs 1, rural wards 1, urban wards 1, elections 1
- Backup `.winwinbak`, extra constituency, restore recovered original list
- Restart same test profile; counts persisted

Linux launch used `--no-sandbox --disable-gpu` as an environment-specific test workaround only. Production `npm run dev` does not add those flags.

Backup/restore in that journey skipped native file dialogs via `WINWIN_TEST_BACKUP_FILE` (test profile only). Interactive Save/Open dialogs were not clicked on Windows or macOS.

## Native module

`better-sqlite3` Node ABI is 127; Electron 33 ABI is 130. `npm rebuild` for Node leaves Electron's `.forge-meta` stale, so `install-app-deps` can skip a Node-built binary. `scripts/run-tests.mjs` deletes that stamp and force-rebuilds for Electron after tests.

## Packaging inspection (Linux)

`electron-builder --linux dir` produced `win-win/release/linux-unpacked/`. `app.asar` contains `out/main/index.js`, `out/preload/index.cjs`, `out/renderer/index.html` + assets, and `package.json`. `better_sqlite3.node` is unpacked under `resources/app.asar.unpacked`. Executable name on Linux is `win-win`; Windows/macOS config still uses productName **WIN WIN**. `chrome-sandbox` is present. This does not prove a Windows or macOS installer.
