#!/usr/bin/env node
/**
 * Launch a production JS build against an isolated userData folder.
 * Does not touch the normal WIN WIN database.
 *
 * Linux Chromium sandbox: production launch keeps sandbox enabled.
 * Set WINWIN_LINUX_NO_SANDBOX=1 only as an environment-specific test workaround.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { electronBinary, root } from "./process-helpers.mjs";

const profile = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), "win-win-ui-test-profile");
fs.mkdirSync(profile, { recursive: true });

const args = [
  path.join(root, "out", "main", "index.js"),
  `--user-data-dir=${profile}`,
  "--remote-debugging-port=9222",
  ...process.argv.slice(2)
];

if (process.platform === "linux" && process.env.WINWIN_LINUX_NO_SANDBOX === "1") {
  args.push("--no-sandbox", "--disable-gpu");
  console.warn("Linux test workaround: launching with --no-sandbox. This is not a production default.");
}

console.log(`WIN WIN test profile: ${profile}`);
console.log("This directory is separate from the normal application data folder.");

const child = spawn(electronBinary(), args, {
  stdio: "inherit",
  shell: false,
  cwd: root,
  env: process.env
});
child.on("exit", (code) => process.exit(code ?? 1));
