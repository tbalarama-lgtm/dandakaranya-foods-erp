#!/usr/bin/env node
/**
 * Rebuild better-sqlite3 for Node, run Vitest, then always restore the Electron ABI
 * so a test failure cannot leave `npm run dev` or packaging broken.
 */
import process from "node:process";
import { electronBuilderInstallAppDeps, npmRebuildSqlite, resolvePackageFile, runNode } from "./process-helpers.mjs";

function restoreElectron() {
  console.log("Restoring better-sqlite3 for Electron…");
  const status = electronBuilderInstallAppDeps();
  if (status !== 0) {
    console.error("Electron ABI restore failed. Run: npm run rebuild:electron");
  }
  return status;
}

console.log("Rebuilding better-sqlite3 for Node.js (tests)…");
const nodeRebuild = npmRebuildSqlite();
if (nodeRebuild !== 0) {
  console.error("Node rebuild failed; restoring Electron ABI.");
  restoreElectron();
  process.exit(nodeRebuild);
}

const extraArgs = process.argv.slice(2);
const vitestCli = resolvePackageFile("vitest/vitest.mjs");
const testStatus = runNode(vitestCli, ["run", ...extraArgs]);

const electronStatus = restoreElectron();
if (electronStatus !== 0) process.exit(electronStatus);
process.exit(testStatus);
