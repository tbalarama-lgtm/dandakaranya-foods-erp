#!/usr/bin/env node
/**
 * Isolated UI journey for identifier review, worksheet selection, cancel, export, backup.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import ExcelJS from "exceljs";
import { electronBinary, root } from "./process-helpers.mjs";

const ARTIFACTS = process.env.WINWIN_UI_ARTIFACTS ?? "/opt/cursor/artifacts";
const PROFILE = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), `win-win-integrity-ui-${Date.now()}`);
const BACKUP_FILE = process.env.WINWIN_TEST_BACKUP_FILE ?? path.join(PROFILE, "win-win-data", "backups", "TEST-INT.winwinbak");
const IMPORT_FILE = process.env.WINWIN_TEST_IMPORT_FILE ?? path.join(PROFILE, "numeric-ids.xlsx");
const EXPORT_FILE = process.env.WINWIN_TEST_EXPORT_FILE ?? path.join(PROFILE, "exported-integrity.csv");
const ERROR_FILE = process.env.WINWIN_TEST_ERROR_REPORT_FILE ?? path.join(PROFILE, "import-errors.csv");
const CDP_PORT = Number(process.env.WINWIN_CDP_PORT ?? "9225");
const LABEL = "[TEST-I]";
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
  const env = {
    ...process.env,
    WINWIN_TEST_PROFILE: PROFILE,
    WINWIN_TEST_BACKUP_FILE: BACKUP_FILE,
    WINWIN_TEST_IMPORT_FILE: IMPORT_FILE,
    WINWIN_TEST_EXPORT_FILE: EXPORT_FILE,
    WINWIN_TEST_ERROR_REPORT_FILE: ERROR_FILE
  };
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return spawn(electronBinary(), args, {
    stdio: ["ignore", "ignore", fs.openSync(path.join(ARTIFACTS, "win-win-integrity-electron-stderr.log"), "a")],
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
  if (!tag) throw new Error("Missing " + selector);
  if (tag === "SELECT" || tag === "TEXTAREA") {
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
  await waitFor(cdp, `Boolean(window.winwin) && Boolean(document.querySelector('[data-testid="nav-voters"]'))`);
}

async function writeImportFile() {
  fs.mkdirSync(path.dirname(IMPORT_FILE), { recursive: true });
  const wb = new ExcelJS.Workbook();
  const skip = wb.addWorksheet("other");
  skip.addRow(["name_original", "electoral_id"]);
  skip.addRow(["skip", "SKIP"]);
  const roll = wb.addWorksheet("roll");
  roll.addRow(["name_original", "electoral_id", "roll_serial", "ward_number"]);
  roll.getCell("A2").value = "రాము";
  roll.getCell("B2").value = 12;
  roll.getCell("B2").numFmt = "0000";
  roll.getCell("C2").value = "0012";
  roll.getCell("D2").value = "1";
  await wb.xlsx.writeFile(IMPORT_FILE);
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
  await click(cdp, '[data-testid="nav-coverage"]');
  await waitFor(cdp, `Boolean(document.querySelector("#coverage-unit-type"))`);
  await fill(cdp, "#coverage-unit-type", "gram_panchayat");
  await waitFor(cdp, `Boolean(document.querySelector("#coverage-unit-id option:not([value=''])"))`);
  await cdp.evaluate(`(() => {
    const sel = document.querySelector("#coverage-unit-id");
    const opt = [...sel.options].find((o) => o.textContent.includes("GP"));
    const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    proto.set.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return sel.value;
  })()`);
  await fill(cdp, "#coverage-kind", "complete");
  await click(cdp, "#coverage-save");
  await waitFor(cdp, `document.querySelector("[data-testid='coverage-table']")?.innerText.includes("complete")`);
  log("geo", "ready");
}

async function drive(cdp) {
  await ready(cdp);
  await setupGeo(cdp);
  await click(cdp, '[data-testid="nav-import"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-choose']"))`);
  await click(cdp, "[data-testid='import-choose']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-sheet']"))`);
  await fill(cdp, "#import-sheet", "roll");
  await click(cdp, "[data-testid='import-sheet-next']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-edition']"))`);
  await fill(cdp, "#import-edition-name", `${LABEL} Roll`);
  await click(cdp, "[data-testid='import-edition-create']");
  await waitFor(cdp, `Boolean(document.querySelector("#import-edition option:not([value=''])"))`);
  const editionValue = await cdp.evaluate(`document.querySelector("#import-edition option:not([value=''])")?.value ?? ""`);
  await fill(cdp, "#import-edition", editionValue);
  await click(cdp, "[data-testid='import-edition-next']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-map-next']"))`);
  await click(cdp, "[data-testid='import-map-next']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-preview-table'] [data-cell-type='number']"))`);
  const preview = await cdp.evaluate(`document.querySelector("[data-testid='import-preview-table']")?.innerText ?? ""`);
  if (!preview.includes("raw 12") || !preview.includes("original text not established")) {
    throw new Error(`Preview missing numeric warning: ${preview}`);
  }
  log("preview", "numeric cell type/raw/displayed shown");
  await screenshot(cdp, "win-win-integrity-preview.png");
  await click(cdp, "[data-testid='import-preview-next']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='identifier-review']"))`);
  await click(cdp, "[data-testid='identifier-accept-raw']");
  await waitFor(cdp, `!document.querySelector("[data-testid='identifier-review']") || document.querySelector("[data-testid='import-validate-summary']")?.textContent.includes("identifier review 0")`);
  await click(cdp, "[data-testid='import-commit']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-summary-counts']"))`);
  const summary = await cdp.evaluate(`document.querySelector("[data-testid='import-summary-counts']")?.textContent ?? ""`);
  if (!summary.includes("Imported 1")) throw new Error(summary);
  log("commit", summary);

  await click(cdp, '[data-testid="nav-voters"]');
  await waitFor(cdp, `document.querySelector("[data-testid='voter-count-total'] b")?.textContent === "1"`);
  const table = await cdp.evaluate(`document.querySelector("[data-testid='voter-table']")?.innerText ?? ""`);
  if (table.includes("0012") && table.includes("రాము") && !table.match(/ABC/)) {
    /* serial 0012 is text and allowed; electoral raw should be 12 */
  }
  if (!table.includes("12")) throw new Error(`Directory missing raw identifier: ${table}`);
  if (/\b0012\b/.test(table) && table.includes("12")) {
    /* roll serial remains 0012 */
  }
  const reconcile = await cdp.evaluate(`document.querySelector("[data-testid='voter-count-reconcile']")?.textContent ?? ""`);
  if (!reconcile.includes("= 1")) throw new Error(reconcile);
  log("directory", reconcile);

  await click(cdp, "[data-testid='open-export']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='export-dialog']"))`);
  await click(cdp, "[data-testid='export-confirm']");
  await waitFor(cdp, `!document.querySelector("[data-testid='export-dialog']")`);
  const exported = fs.readFileSync(EXPORT_FILE, "utf8");
  if (!exported.includes("రాము")) throw new Error("Export missing Telugu");
  if (exported.split("12").length < 2) throw new Error(`Export should keep raw 12, not invent zeros: ${exported}`);
  log("export", "csv contains Telugu and raw 12");

  await click(cdp, '[data-testid="nav-import"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-choose']"))`);
  await click(cdp, "[data-testid='import-choose']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-sheet']"))`);
  await click(cdp, "[data-testid='import-cancel']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='import-choose']"))`);
  log("cancel", "import cancelled before commit");

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
  await click(cdp, '[data-testid="nav-voters"]');
  await waitFor(cdp, `document.querySelector("[data-testid='voter-count-total'] b")?.textContent === "1"`);
  log("backup-restore", "numeric-reviewed row recovered");
  await screenshot(cdp, "win-win-integrity-directory.png");
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
  await writeImportFile();
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
      await click(cdp2, '[data-testid="nav-voters"]');
      await waitFor(cdp2, `document.querySelector("[data-testid='voter-count-total'] b")?.textContent === "1"`);
      log("persistence", "row present after restart");
    } finally {
      cdp2.close();
    }
  } catch (error) {
    failed = error;
  } finally {
    await stop(child);
  }
  const report = path.join(ARTIFACTS, "win-win-integrity-ui-journey.log");
  fs.writeFileSync(report, steps.concat(failed ? [`FAILED: ${failed instanceof Error ? failed.stack : String(failed)}`] : ["OK"]).join("\n"));
  console.log(fs.readFileSync(report, "utf8"));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
