import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

export function nodeBin() {
  return process.execPath;
}

export function resolvePackageFile(specifier) {
  try {
    return require.resolve(specifier, { paths: [root] });
  } catch {
    return path.join(root, "node_modules", specifier);
  }
}

export function runNode(scriptPath, args = [], options = {}) {
  const result = spawnSync(nodeBin(), [scriptPath, ...args], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
    shell: false,
    ...options
  });
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  return result.status ?? 1;
}

export function spawnNode(scriptPath, args = [], options = {}) {
  return spawn(nodeBin(), [scriptPath, ...args], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
    shell: false,
    ...options
  });
}

function sqliteForgeMeta() {
  return path.join(root, "node_modules", "better-sqlite3", "build", "Release", ".forge-meta");
}

export function npmRebuildSqlite() {
  const npmCli = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCli, ["rebuild", "better-sqlite3"], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  // npm rebuild for Node does not update Electron's .forge-meta stamp.
  // Delete it so the next Electron rebuild cannot skip a Node-ABI binary.
  fs.rmSync(sqliteForgeMeta(), { force: true });
  return result.status ?? 1;
}

export function electronBuilderInstallAppDeps() {
  const rebuildCli = path.join(root, "node_modules", "@electron", "rebuild", "lib", "cli.js");
  const forced = runNode(rebuildCli, [
    "--force",
    "--only",
    "better-sqlite3",
    "--module-dir",
    root,
    "--electron-prebuilt-dir",
    path.join(root, "node_modules", "electron")
  ]);
  if (forced !== 0) return forced;
  const cli = resolvePackageFile("electron-builder/cli.js");
  return runNode(cli, ["install-app-deps"]);
}

export function electronBinary() {
  return process.platform === "win32"
    ? path.join(root, "node_modules", "electron", "dist", "electron.exe")
    : path.join(root, "node_modules", "electron", "dist", "electron");
}
