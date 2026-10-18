#!/usr/bin/env node
/**
 * Drive Phase 1 UI against an isolated Electron userData profile.
 * Never writes to the normal application database.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { electronBinary, root } from "./process-helpers.mjs";

const ARTIFACTS = process.env.WINWIN_UI_ARTIFACTS ?? "/opt/cursor/artifacts";
const PROFILE = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), `win-win-ui-test-${Date.now()}`);
const BACKUP_FILE = process.env.WINWIN_TEST_BACKUP_FILE ?? path.join(PROFILE, "win-win-data", "backups", "TEST-UI.winwinbak");
const CDP_PORT = Number(process.env.WINWIN_CDP_PORT ?? "9222");
const LABEL = "[TEST-UI]";

const steps = [];
function log(name, detail = "") {
  const line = detail ? `${name}: ${detail}` : name;
  steps.push(line);
  console.log(`• ${line}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.setTimeout(2000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      else waiter.resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(text);
    }
    return result.result.value;
  }

  close() {
    this.ws?.close();
  }
}

function launchElectron() {
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = [
    path.join(root, "out", "main", "index.js"),
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${CDP_PORT}`
  ];
  if (process.platform === "linux") {
    args.push("--no-sandbox", "--disable-gpu");
    log("linux-workaround", "--no-sandbox --disable-gpu used for this Linux UI journey only");
  }
  const env = {
    ...process.env,
    WINWIN_TEST_PROFILE: PROFILE,
    WINWIN_TEST_BACKUP_FILE: BACKUP_FILE
  };
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const child = spawn(electronBinary(), args, {
    stdio: ["ignore", "ignore", fs.openSync(path.join(ARTIFACTS, "win-win-electron-stderr.log"), "a")],
    shell: false,
    cwd: root,
    env
  });
  return child;
}

async function waitForCdp(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { status, body } = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (status === 200) {
        const targets = JSON.parse(body);
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error("Timed out waiting for Electron CDP.");
}

async function waitFor(cdp, expression, timeoutMs = 15000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await cdp.evaluate(expression);
    if (last) return last;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for: ${expression}\nLast: ${JSON.stringify(last)}`);
}

const FILL = String.raw`
(selector, value) => {
  const el = document.querySelector(selector);
  if (!el) throw new Error("Missing " + selector);
  const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype
    : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc.set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return el.value;
}
`;

async function fill(cdp, selector, value) {
  const tag = await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.tagName ?? ""`);
  if (!tag) throw new Error("Missing " + selector);
  if (tag === "SELECT") {
    return cdp.evaluate(`(${FILL})(${JSON.stringify(selector)}, ${JSON.stringify(value)})`);
  }
  await cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.focus();
    if (typeof el.select === "function") el.select();
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await cdp.send("Input.insertText", { text: String(value) });
  return cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.value ?? ""`);
}

async function click(cdp, selector) {
  return cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error("Missing " + ${JSON.stringify(selector)});
    el.click();
    return true;
  })()`);
}

async function textOf(cdp, selector) {
  return cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ""`);
}

async function screenshot(cdp, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const result = await cdp.send("Page.captureScreenshot", { format: "png" });
  const dest = path.join(ARTIFACTS, name);
  fs.writeFileSync(dest, Buffer.from(result.data, "base64"));
  log("screenshot", dest);
}

async function ready(cdp) {
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.evaluate(`window.confirm = () => true; true;`);
  await waitFor(cdp, `Boolean(window.winwin) && !document.body.innerText.includes("Loading WIN WIN")`);
}

async function drive(cdp) {
  await ready(cdp);
  await screenshot(cdp, "win-win-ui-00-empty.png");

  await click(cdp, '[data-testid="nav-settings"]');
  await waitFor(cdp, `document.body.innerText.includes("Create assembly constituency")`);
  await fill(cdp, "#constituency-name", `${LABEL} Assembly North`);
  await fill(cdp, "#constituency-name-te", "పరీక్ష నియోజకవర్గం");
  await click(cdp, "#constituency-create");
  await waitFor(cdp, `document.querySelector("#topbar-constituency")?.selectedOptions[0]?.textContent.includes("Assembly North")`);
  log("constituency", "created and selected");

  await fill(cdp, "#boundary-name", `${LABEL} Boundaries 2026`);
  await click(cdp, "#boundary-create");
  await waitFor(cdp, `document.querySelector("#topbar-boundary")?.selectedOptions[0]?.textContent.includes("Boundaries 2026")`);
  log("boundary", "created and selected");

  await click(cdp, '[data-testid="nav-rural"]');
  await waitFor(cdp, `Boolean(document.querySelector("#rural-name"))`);
  await fill(cdp, "#rural-record-type", "mandal");
  await fill(cdp, "#rural-name", `${LABEL} Mandal Complete`);
  await fill(cdp, "#rural-map-kind", "complete");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="${LABEL} Mandal Complete"]'))`);
  await click(cdp, `[data-name="${LABEL} Mandal Complete"]`);
  log("mandal", "complete coverage");

  await fill(cdp, "#rural-record-type", "gp");
  await fill(cdp, "#rural-name", `${LABEL} GP East`);
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="${LABEL} GP East"]'))`);
  await click(cdp, `[data-name="${LABEL} GP East"]`);
  log("gram-panchayat", "created");

  await fill(cdp, "#rural-record-type", "village");
  await fill(cdp, "#rural-name", `${LABEL} Village A`);
  await click(cdp, "#rural-create");
  await waitFor(cdp, `document.body.innerText.includes("${LABEL} Village A")`);
  log("village", "created");

  await fill(cdp, "#rural-record-type", "ward");
  await waitFor(cdp, `Boolean(document.querySelector("#rural-ward-number"))`);
  await fill(cdp, "#rural-ward-number", "1");
  await fill(cdp, "#rural-name", `${LABEL} Rural Ward 1`);
  await click(cdp, "#rural-create");
  await waitFor(cdp, `document.body.innerText.includes("${LABEL} Rural Ward 1")`);
  log("rural-ward", "created");

  await cdp.evaluate(`document.querySelector("table .btn.secondary")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='ward-breadcrumb']"))`);
  const crumbs = await textOf(cdp, "[data-testid='ward-breadcrumb']");
  if (!crumbs.includes("Mandal Complete") || !crumbs.includes("GP East")) {
    throw new Error(`Unexpected breadcrumb: ${crumbs}`);
  }
  log("breadcrumb", crumbs.trim());
  await fill(cdp, "#village-ward-id", await cdp.evaluate(`document.querySelector("#village-ward-id option:not([value=''])")?.value ?? ""`));
  await click(cdp, "#village-ward-save");
  await waitFor(cdp, `document.body.innerText.includes("${LABEL} Village A") && document.body.innerText.includes("complete")`);
  log("village-ward", "mapped complete");

  await click(cdp, '[data-testid="nav-rural"]');
  await waitFor(cdp, `Boolean(document.querySelector("#rural-name"))`);
  await fill(cdp, "#rural-record-type", "mandal");
  await fill(cdp, "#rural-name", `${LABEL} Mandal Partial`);
  await fill(cdp, "#rural-map-kind", "partial");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="${LABEL} Mandal Partial"]'))`);
  await click(cdp, `[data-name="${LABEL} Mandal Partial"]`);
  await fill(cdp, "#rural-record-type", "gp");
  await fill(cdp, "#rural-name", `${LABEL} GP Hidden`);
  await fill(cdp, "#rural-map-kind", "none");
  await click(cdp, "#rural-create");
  await sleep(500);
  const hiddenGp = await cdp.evaluate(`Boolean(document.querySelector('[data-name="${LABEL} GP Hidden"]'))`);
  if (hiddenGp) throw new Error("Partial mandal incorrectly expanded a child Gram Panchayat.");
  log("partial-coverage", "child GP not implied");

  await click(cdp, '[data-testid="nav-urban"]');
  await waitFor(cdp, `Boolean(document.querySelector("#ulb-name"))`);
  await fill(cdp, "#ulb-map-kind", "partial");
  await fill(cdp, "#ulb-name", `${LABEL} Municipality`);
  await click(cdp, "#ulb-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="${LABEL} Municipality"]'))`);
  await click(cdp, `[data-name="${LABEL} Municipality"]`);
  await fill(cdp, "#urban-ward-number", "12");
  await fill(cdp, "#urban-ward-name", `${LABEL} Urban Ward 12`);
  await click(cdp, "#urban-ward-create");
  await sleep(400);
  log("urban", "ULB partial + urban ward created");

  await click(cdp, '[data-testid="nav-coverage"]');
  await waitFor(cdp, `Boolean(document.querySelector("#coverage-unit-type"))`);
  await fill(cdp, "#coverage-unit-type", "urban_ward");
  await sleep(200);
  const urbanWardId = await cdp.evaluate(`{
    const opt = [...document.querySelectorAll("#coverage-unit-id option")].find((o) => o.textContent.includes("Urban Ward 12"));
    if (!opt) throw new Error("Urban ward missing from coverage dropdown");
    opt.value;
  }`);
  await fill(cdp, "#coverage-unit-id", urbanWardId);
  await fill(cdp, "#coverage-kind", "complete");
  await click(cdp, "#coverage-save");
  await waitFor(cdp, `document.body.innerText.includes("Urban Ward 12")`);
  log("coverage", "complete mandal + partial ULB + complete urban ward");
  await screenshot(cdp, "win-win-ui-01-coverage.png");

  await click(cdp, '[data-testid="nav-wards"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='ward-table']"))`);
  await fill(cdp, '[data-testid="ward-classification"]', "rural");
  await sleep(400);
  const ruralOnly = await cdp.evaluate(`document.querySelector("[data-testid='ward-table']")?.innerText ?? ""`);
  if (!ruralOnly.includes("Rural Ward 1") || ruralOnly.includes("Urban Ward 12")) {
    throw new Error("Rural ward filter failed.");
  }
  await fill(cdp, '[data-testid="ward-classification"]', "urban");
  await sleep(400);
  const urbanOnly = await cdp.evaluate(`document.querySelector("[data-testid='ward-table']")?.innerText ?? ""`);
  if (!urbanOnly.includes("Urban Ward 12") || urbanOnly.includes("Rural Ward 1")) {
    throw new Error("Urban ward filter failed.");
  }
  await fill(cdp, '[data-testid="ward-search"]', "Rural Ward 1");
  await fill(cdp, '[data-testid="ward-classification"]', "");
  await sleep(400);
  const searched = await cdp.evaluate(`document.querySelector("[data-testid='ward-table']")?.innerText ?? ""`);
  if (!searched.includes("Rural Ward 1")) throw new Error("Ward search failed.");
  log("ward-directory", "classification filters and search");

  await click(cdp, '[data-testid="nav-elections"]');
  await waitFor(cdp, `Boolean(document.querySelector("#election-name"))`);
  await fill(cdp, "#election-name", `${LABEL} Assembly 2026`);
  await click(cdp, "#election-create");
  await waitFor(cdp, `document.body.innerText.includes("${LABEL} Assembly 2026")`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid^='election-archive-']"))`);
  await click(cdp, "[data-testid^='election-archive-']");
  await waitFor(cdp, `document.body.innerText.includes("Frozen")`);
  log("election", "created and archived");

  await click(cdp, '[data-testid="nav-dashboard"]');
  await waitFor(cdp, `Boolean(document.querySelector('[data-testid="stat-value-mandals"]'))`);
  const counts = await cdp.evaluate(`({
    mandals: document.querySelector('[data-testid="stat-value-mandals"]')?.textContent,
    gps: document.querySelector('[data-testid="stat-value-gram-panchayats"]')?.textContent,
    villages: document.querySelector('[data-testid="stat-value-villages"]')?.textContent,
    ulbs: document.querySelector('[data-testid="stat-value-urban-local-bodies"]')?.textContent,
    rural: document.querySelector('[data-testid="stat-value-rural-wards"]')?.textContent,
    urban: document.querySelector('[data-testid="stat-value-urban-wards"]')?.textContent,
    elections: document.querySelector('[data-testid="stat-value-election-workspaces"]')?.textContent
  })`);
  log("dashboard", JSON.stringify(counts));
  if (counts.mandals !== "2" || counts.gps !== "1" || counts.villages !== "1") {
    throw new Error(`Unexpected rural dashboard counts: ${JSON.stringify(counts)}`);
  }
  if (counts.ulbs !== "1" || counts.rural !== "1" || counts.urban !== "1" || counts.elections !== "1") {
    throw new Error(`Unexpected dashboard counts: ${JSON.stringify(counts)}`);
  }
  await screenshot(cdp, "win-win-ui-02-dashboard.png");

  await click(cdp, '[data-testid="nav-backup"]');
  await waitFor(cdp, `Boolean(document.querySelector("#backup-create"))`);
  await click(cdp, "#backup-create");
  await waitFor(cdp, `document.querySelector("[data-testid='backup-message']")?.textContent.includes("Backup saved")`, 20000);
  if (!fs.existsSync(BACKUP_FILE)) throw new Error("Backup file was not written to the test profile.");
  log("backup", BACKUP_FILE);

  await click(cdp, '[data-testid="nav-settings"]');
  await waitFor(cdp, `Boolean(document.querySelector("#constituency-name"))`);
  await fill(cdp, "#constituency-name", `${LABEL} TEMP CHANGE`);
  await click(cdp, "#constituency-create");
  await waitFor(cdp, `document.querySelector("#topbar-constituency")?.innerText.includes("TEMP CHANGE")`);
  log("mutation", "extra constituency after backup");

  await click(cdp, '[data-testid="nav-backup"]');
  await click(cdp, "#backup-restore");
  await waitFor(cdp, `document.querySelector("[data-testid='backup-message']")?.textContent.includes("Restore complete")`, 20000);
  await sleep(800);
  const afterRestore = await cdp.evaluate(`document.querySelector("#topbar-constituency")?.innerText ?? ""`);
  if (afterRestore.includes("TEMP CHANGE") || !afterRestore.includes("Assembly North")) {
    throw new Error(`Restore did not recover constituency list: ${afterRestore}`);
  }
  log("restore", "temporary constituency removed");
  await screenshot(cdp, "win-win-ui-03-restore.png");

  return counts;
}

async function connectAndDrive() {
  const wsUrl = await waitForCdp();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();
  try {
    return await drive(cdp);
  } finally {
    cdp.close();
  }
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode == null) child.kill("SIGKILL");
    }, 3000);
  });
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });
  log("profile", PROFILE);
  log("real-user-data", "untouched");

  let child = launchElectron();
  let failed = null;
  try {
    await connectAndDrive();
    await stop(child);
    log("restart", "reopening the same test profile");
    child = launchElectron();
    const wsUrl = await waitForCdp();
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    try {
      await ready(cdp);
      await waitFor(cdp, `document.querySelector("#topbar-constituency")?.innerText.includes("Assembly North")`);
      const persisted = await cdp.evaluate(`document.querySelector('[data-testid="stat-value-mandals"]')?.textContent ?? document.body.innerText`);
      await click(cdp, '[data-testid="nav-dashboard"]');
      await waitFor(cdp, `document.querySelector('[data-testid="stat-value-mandals"]')?.textContent === "2"`);
      const counts = await cdp.evaluate(`document.querySelector('[data-testid="stat-value-election-workspaces"]')?.textContent`);
      if (counts !== "1") throw new Error(`Persisted election count ${counts}`);
      log("persistence", persisted);
      await screenshot(cdp, "win-win-ui-04-restart.png");
    } finally {
      cdp.close();
    }
  } catch (error) {
    failed = error;
  } finally {
    await stop(child);
  }

  const report = path.join(ARTIFACTS, "win-win-ui-journey.log");
  const body = steps.concat(failed ? [`FAILED: ${failed instanceof Error ? failed.stack : String(failed)}`] : ["OK"]).join("\n");
  fs.writeFileSync(report, body);
  console.log(body);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
