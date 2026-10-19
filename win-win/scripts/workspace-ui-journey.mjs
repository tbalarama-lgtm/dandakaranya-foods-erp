#!/usr/bin/env node
/**
 * Drive Phase 2 ward workspace UI against an isolated userData profile.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { electronBinary, root } from "./process-helpers.mjs";

const ARTIFACTS = process.env.WINWIN_UI_ARTIFACTS ?? "/opt/cursor/artifacts";
const PROFILE = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), `win-win-ws-ui-${Date.now()}`);
const BACKUP_FILE = process.env.WINWIN_TEST_BACKUP_FILE ?? path.join(PROFILE, "win-win-data", "backups", "TEST-WS.winwinbak");
const CDP_PORT = Number(process.env.WINWIN_CDP_PORT ?? "9223");
const LABEL = "[TEST-WS]";
const steps = [];
const log = (name, detail = "") => {
  const line = detail ? `${name}: ${detail}` : name;
  steps.push(line);
  console.log(`• ${line}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.setTimeout(2000, () => req.destroy(new Error("timeout")));
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
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }
  close() {
    this.ws?.close();
  }
}

function launchElectron() {
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = [path.join(root, "out", "main", "index.js"), `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${CDP_PORT}`];
  if (process.platform === "linux") args.push("--no-sandbox", "--disable-gpu");
  const env = { ...process.env, WINWIN_TEST_PROFILE: PROFILE, WINWIN_TEST_BACKUP_FILE: BACKUP_FILE };
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return spawn(electronBinary(), args, {
    stdio: ["ignore", "ignore", fs.openSync(path.join(ARTIFACTS, "win-win-ws-electron-stderr.log"), "a")],
    shell: false,
    cwd: root,
    env
  });
}

async function waitForCdp(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { status, body } = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (status === 200) {
        const page = JSON.parse(body).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
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

const FILL = `(selector, value) => {
  const el = document.querySelector(selector);
  if (!el) throw new Error("Missing " + selector);
  const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype
    : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return el.value;
}`;

async function fill(cdp, selector, value) {
  const tag = await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.tagName ?? ""`);
  const type = await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.getAttribute("type") ?? ""`);
  if (!tag) throw new Error("Missing " + selector);
  if (tag === "SELECT" || tag === "TEXTAREA" || type === "date" || type === "number") {
    return cdp.evaluate(`(${FILL})(${JSON.stringify(selector)}, ${JSON.stringify(value)})`);
  }
  await cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.focus();
    if (typeof el.select === "function") el.select();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await cdp.send("Input.insertText", { text: String(value) });
}

async function click(cdp, selector) {
  return cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error("Missing " + ${JSON.stringify(selector)});
    el.click();
    return true;
  })()`);
}

async function screenshot(cdp, name) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS, name), Buffer.from(result.data, "base64"));
  log("screenshot", name);
}

async function ready(cdp) {
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.evaluate(`window.confirm = () => true; true;`);
  await waitFor(cdp, `Boolean(window.winwin) && Boolean(document.querySelector('[data-testid="nav-rural"]'))`);
}

async function setupGeo(cdp) {
  await click(cdp, '[data-testid="nav-settings"]');
  await waitFor(cdp, `Boolean(document.querySelector("#constituency-name"))`);
  await fill(cdp, "#constituency-name", `${LABEL} Seat`);
  await click(cdp, "#constituency-create");
  await waitFor(cdp, `document.querySelector("#topbar-constituency")?.innerText.includes("Seat")`);
  await fill(cdp, "#boundary-name", `${LABEL} Boundaries`);
  await click(cdp, "#boundary-create");
  await waitFor(cdp, `document.querySelector("#topbar-boundary")?.innerText.includes("Boundaries")`);
  await click(cdp, '[data-testid="nav-rural"]');
  await waitFor(cdp, `Boolean(document.querySelector("#rural-name"))`);
  await fill(cdp, "#rural-name", `${LABEL} Mandal`);
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="${LABEL} Mandal"]'))`);
  await click(cdp, `[data-name="${LABEL} Mandal"]`);
  await fill(cdp, "#rural-record-type", "gp");
  await fill(cdp, "#rural-name", `${LABEL} GP`);
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="${LABEL} GP"]'))`);
  await click(cdp, `[data-name="${LABEL} GP"]`);
  await fill(cdp, "#rural-record-type", "ward");
  await waitFor(cdp, `Boolean(document.querySelector("#rural-ward-number"))`);
  await fill(cdp, "#rural-ward-number", "1");
  await fill(cdp, "#rural-name", `${LABEL} Ward 1`);
  await click(cdp, "#rural-create");
  await waitFor(cdp, `document.body.innerText.includes("${LABEL} Ward 1")`);
  await cdp.evaluate(`document.querySelector("table .btn.secondary")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='tab-overview']"))`);
  log("geo", "constituency, boundary, rural ward opened");
}

async function drive(cdp) {
  await ready(cdp);
  await setupGeo(cdp);
  await click(cdp, "[data-testid='tab-contacts']");
  await click(cdp, "[data-testid='contact-add']");
  await waitFor(cdp, `Boolean(document.querySelector("#contact-name"))`);
  await fill(cdp, "#contact-name", `${LABEL} Lakshmi`);
  await fill(cdp, "#contact-org", "GP office");
  await fill(cdp, "#contact-role", "Sarpanch");
  await fill(cdp, "#contact-consent", "given");
  await fill(cdp, "#contact-consent-date", "2026-01-15");
  await fill(cdp, "#contact-consent-source", "in person");
  await fill(cdp, "#contact-phone", "9000000000");
  await click(cdp, "#contact-save");
  await waitFor(
    cdp,
    `document.querySelector("[data-testid='contact-table']")?.innerText.includes("Lakshmi") || document.querySelector("[data-testid='app-error']")?.textContent`,
    8000
  );
  const contactErr = await cdp.evaluate(`document.querySelector("[data-testid='app-error']")?.textContent ?? ""`);
  const table = await cdp.evaluate(`document.querySelector("[data-testid='contact-table']")?.innerText ?? ""`);
  if (!table.includes("Lakshmi")) throw new Error(`Contact not created. error=${contactErr} table=${table}`);
  log("contact", "created with consent");

  await click(cdp, "[data-testid='tab-team']");
  await click(cdp, "[data-testid='team-add']");
  await waitFor(cdp, `Boolean(document.querySelector("#team-person"))`);
  const personValue = await cdp.evaluate(`document.querySelector("#team-person option:not([value=''])")?.value ?? ""`);
  if (!personValue) throw new Error("Person missing from team select");
  await fill(cdp, "#team-person", personValue);
  await fill(cdp, "#team-role", "ward_coordinator");
  await click(cdp, "#team-save");
  await waitFor(cdp, `document.querySelector("[data-testid='team-table']")?.innerText.includes("Lakshmi")`);
  log("team", "assignment created");

  await click(cdp, "[data-testid='tab-issues']");
  await click(cdp, "[data-testid='issue-add']");
  await waitFor(cdp, `Boolean(document.querySelector("#issue-title"))`);
  await fill(cdp, "#issue-title", `${LABEL} Water leak`);
  await fill(cdp, "#issue-category", "water");
  const resp = await cdp.evaluate(`document.querySelector("#issue-responsible option:not([value=''])")?.value ?? ""`);
  if (resp) await fill(cdp, "#issue-responsible", resp);
  await click(cdp, "#issue-save");
  await waitFor(cdp, `document.querySelector("[data-testid='issue-table']")?.innerText.includes("Water leak")`);
  log("issue", "created");

  await click(cdp, "[data-testid='tab-tasks']");
  await click(cdp, "[data-testid='task-add']");
  await waitFor(cdp, `Boolean(document.querySelector("#task-title"))`);
  await fill(cdp, "#task-title", `${LABEL} Inspect pipe`);
  const assignee = await cdp.evaluate(`document.querySelector("#task-assignee option:not([value=''])")?.value ?? ""`);
  if (assignee) await fill(cdp, "#task-assignee", assignee);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const due = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await fill(cdp, "#task-due", due);
  await click(cdp, "#task-save");
  await waitFor(cdp, `document.querySelector("[data-testid='task-table']")?.innerText.includes("Inspect pipe")`);
  await cdp.evaluate(`document.querySelector("[data-testid='task-table'] .btn.secondary")?.click(); true;`);
  await waitFor(cdp, `document.querySelector("#task-title")?.value.includes("Inspect pipe")`);
  await fill(cdp, "#task-status", "done");
  await fill(cdp, "#task-notes", "Completed on site");
  await click(cdp, "#task-save");
  await waitFor(cdp, `document.querySelector("[data-testid='task-table']")?.innerText.includes("completed")`);
  log("task", "created and completed");

  await click(cdp, "[data-testid='tab-issues']");
  await waitFor(cdp, `document.body.innerText.includes("Water leak")`);
  await cdp.evaluate(`document.querySelector("[data-testid='issue-table'] .btn.secondary")?.click(); true;`);
  await waitFor(cdp, `document.querySelector("#issue-title")?.value.includes("Water leak")`);
  await fill(cdp, "#issue-status", "resolved");
  await fill(cdp, "#issue-resolution", "Pipe repaired");
  await click(cdp, "#issue-save");
  await waitFor(cdp, `document.querySelector("[data-testid='issue-table']")?.innerText.includes("resolved")`);
  log("issue", "resolved");

  await click(cdp, "[data-testid='tab-overview']");
  await waitFor(cdp, `document.querySelector("[data-testid='overview-contacts'] b")?.textContent === "1"`);
  const counts = await cdp.evaluate(`({
    contacts: document.querySelector("[data-testid='overview-contacts'] b")?.textContent,
    team: document.querySelector("[data-testid='overview-team'] b")?.textContent,
    issues: document.querySelector("[data-testid='overview-issues'] b")?.textContent,
    tasks: document.querySelector("[data-testid='overview-tasks'] b")?.textContent
  })`);
  if (counts.contacts !== "1" || counts.team !== "1") throw new Error(`Overview counts ${JSON.stringify(counts)}`);
  if (counts.issues !== "0" || counts.tasks !== "0") throw new Error(`Expected resolved/completed counts, got ${JSON.stringify(counts)}`);
  log("overview", JSON.stringify(counts));
  await screenshot(cdp, "win-win-ws-overview.png");

  await click(cdp, '[data-testid="nav-backup"]');
  await waitFor(cdp, `Boolean(document.querySelector("#backup-create"))`);
  await click(cdp, "#backup-create");
  await waitFor(cdp, `document.querySelector("[data-testid='backup-message']")?.textContent.includes("Backup saved")`, 20000);
  await click(cdp, '[data-testid="nav-settings"]');
  await fill(cdp, "#constituency-name", `${LABEL} TEMP`);
  await click(cdp, "#constituency-create");
  await waitFor(cdp, `document.querySelector("#topbar-constituency")?.innerText.includes("TEMP")`);
  await click(cdp, '[data-testid="nav-backup"]');
  await click(cdp, "#backup-restore");
  await waitFor(cdp, `document.querySelector("[data-testid='backup-message']")?.textContent.includes("Restore complete")`, 20000);
  await sleep(500);
  const after = await cdp.evaluate(`document.querySelector("#topbar-constituency")?.innerText ?? ""`);
  if (after.includes("TEMP") || !after.includes("Seat")) throw new Error(`Restore failed: ${after}`);
  log("backup-restore", "workspace records recovered");
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
  log("profile", PROFILE);
  let child = launchElectron();
  let failed = null;
  try {
    const cdp = new CdpClient(await waitForCdp());
    await cdp.connect();
    try {
      await drive(cdp);
    } finally {
      cdp.close();
    }
    await stop(child);
    log("restart", "same test profile");
    child = launchElectron();
    const cdp2 = new CdpClient(await waitForCdp());
    await cdp2.connect();
    try {
      await ready(cdp2);
      await waitFor(cdp2, `Boolean(document.querySelector('[data-testid="nav-rural"]'))`);
      await click(cdp2, '[data-testid="nav-rural"]');
      await waitFor(cdp2, `Boolean(document.querySelector('[data-name="${LABEL} Mandal"]'))`);
      await click(cdp2, `[data-name="${LABEL} Mandal"]`);
      await waitFor(cdp2, `Boolean(document.querySelector('[data-name="${LABEL} GP"]'))`);
      await click(cdp2, `[data-name="${LABEL} GP"]`);
      await waitFor(cdp2, `document.body.innerText.includes("${LABEL} Ward 1")`);
      await cdp2.evaluate(`document.querySelector("table .btn.secondary")?.click(); true;`);
      await waitFor(cdp2, `document.querySelector("[data-testid='overview-contacts'] b")?.textContent === "1"`);
      log("persistence", "overview still shows 1 contact after restart");
      await screenshot(cdp2, "win-win-ws-restart.png");
    } finally {
      cdp2.close();
    }
  } catch (error) {
    failed = error;
  } finally {
    await stop(child);
  }
  const report = path.join(ARTIFACTS, "win-win-ws-ui-journey.log");
  fs.writeFileSync(report, steps.concat(failed ? [`FAILED: ${failed instanceof Error ? failed.stack : String(failed)}`] : ["OK"]).join("\n"));
  console.log(fs.readFileSync(report, "utf8"));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
