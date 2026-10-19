#!/usr/bin/env node
/**
 * Isolated UI journey for Seat Reservations: import review, summary, GP matrix.
 * Uses a synthetic reservation-only workbook (no pension sheets in retained data).
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
const PROFILE = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), `win-win-reservations-ui-${Date.now()}`);
const IMPORT_FILE = process.env.WINWIN_TEST_RESERVATION_FILE ?? path.join(PROFILE, "reservations-source.xlsx");
const EXPORT_FILE = process.env.WINWIN_TEST_EXPORT_FILE ?? path.join(PROFILE, "reservations-export.csv");
const CDP_PORT = Number(process.env.WINWIN_CDP_PORT ?? "9226");
const LABEL = "[TEST-R]";
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
    WINWIN_TEST_RESERVATION_FILE: IMPORT_FILE,
    WINWIN_TEST_EXPORT_FILE: EXPORT_FILE
  };
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return spawn(electronBinary(), args, {
    stdio: ["ignore", "ignore", fs.openSync(path.join(ARTIFACTS, "win-win-reservations-electron-stderr.log"), "a")],
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

async function waitFor(cdp, expression, timeoutMs = 20000) {
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
  await waitFor(cdp, `Boolean(window.winwin) && Boolean(document.querySelector('[data-testid="nav-reservations"]'))`);
}

async function writeReservationFile() {
  fs.mkdirSync(path.dirname(IMPORT_FILE), { recursive: true });
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("PANCHAYAT RESERVATIONS");
  sheet.getCell("A1").value = "Name of the Mandal";
  sheet.getCell("B1").value = "Name of the Gram Panchayat";
  sheet.getCell("C1").value = "Sarpanch Reservation";
  sheet.getCell("D1").value = "NO. OF";
  sheet.getCell("C2").value = 2026;
  sheet.getCell("D2").value = "WARDS";
  sheet.getCell("E2").value = 1;
  sheet.getCell("F2").value = 2;
  sheet.getCell("A3").value = "Tanuku-1";
  sheet.getCell("B3").value = "Duvva";
  sheet.getCell("C3").value = "UR(W)";
  sheet.getCell("D3").value = 2;
  sheet.getCell("E3").value = "BC";
  sheet.getCell("F3").value = "SC(W)";
  const pension = wb.addWorksheet("PENSION DATA");
  pension.addRow(["ssno", "name"]);
  pension.addRow(["1", "must-not-import"]);
  wb.addWorksheet("Sheet5");
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
  await fill(cdp, "#rural-name", "Tanuku");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="Tanuku"]'))`);
  await click(cdp, `[data-name="Tanuku"]`);
  await fill(cdp, "#rural-record-type", "gp");
  await fill(cdp, "#rural-name", "Duvva");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="Duvva"]'))`);
  await click(cdp, `[data-name="Duvva"]`);
  await fill(cdp, "#rural-record-type", "ward");
  await waitFor(cdp, `Boolean(document.querySelector("#rural-ward-number"))`);
  await fill(cdp, "#rural-ward-number", "1");
  await fill(cdp, "#rural-name", "Ward 1");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `document.body.innerText.includes("Ward 1")`);
  await fill(cdp, "#rural-ward-number", "2");
  await fill(cdp, "#rural-name", "Ward 2");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `document.body.innerText.includes("Ward 2")`);
  await click(cdp, '[data-testid="nav-coverage"]');
  await waitFor(cdp, `Boolean(document.querySelector("#coverage-unit-type"))`);
  await fill(cdp, "#coverage-unit-type", "gram_panchayat");
  await waitFor(cdp, `Boolean(document.querySelector("#coverage-unit-id option:not([value=''])"))`);
  await cdp.evaluate(`(() => {
    const sel = document.querySelector("#coverage-unit-id");
    const opt = [...sel.options].find((o) => o.textContent.includes("Duvva"));
    const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    proto.set.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return sel.value;
  })()`);
  await fill(cdp, "#coverage-kind", "complete");
  await click(cdp, "#coverage-save");
  await waitFor(cdp, `document.querySelector("[data-testid='coverage-table']")?.innerText.includes("complete")`);
  await click(cdp, '[data-testid="nav-elections"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='election-name']"))`);
  await fill(cdp, "[data-testid='election-name']", `${LABEL} GP 2026`);
  await fill(cdp, "[data-testid='election-type']", "gram_panchayat");
  await fill(cdp, "[data-testid='election-year']", "2026");
  await cdp.evaluate(`(() => {
    for (const box of document.querySelectorAll('[data-testid^="election-ward-"]')) {
      if (!box.checked) box.click();
    }
    return document.querySelectorAll('[data-testid^="election-ward-"]:checked').length;
  })()`);
  await click(cdp, "[data-testid='election-create']");
  await waitFor(cdp, `document.querySelector("[data-testid='election-table']")?.innerText.includes("GP 2026")`);
  log("geo", "Tanuku / Duvva / election ready");
}

async function drive(cdp) {
  await ready(cdp);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  try {
    const win = await cdp.send("Browser.getWindowForTarget");
    if (win?.windowId != null) {
      await cdp.send("Browser.setWindowBounds", { windowId: win.windowId, bounds: { width: 1440, height: 1100 } });
    }
  } catch {
    /* optional */
  }
  await setupGeo(cdp);
  await click(cdp, '[data-testid="nav-reservations"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='res-tab-import']"))`);
  await click(cdp, "[data-testid='res-tab-import']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='res-import-open']"))`);
  await click(cdp, "[data-testid='res-import-open']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='res-preview-table']"))`);
  const banner = await cdp.evaluate(`document.body.innerText`);
  if (!banner.includes("PENSION DATA") || !banner.includes("Sheet5")) {
    throw new Error("Excluded sheets were not announced.");
  }
  const electionValue = await waitFor(
    cdp,
    `document.querySelector("[data-testid='res-import-election'] option:not([value=''])")?.value ?? ""`
  );
  await fill(cdp, "[data-testid='res-import-election']", electionValue);
  await waitFor(cdp, `document.querySelector("[data-testid='res-preview-table']")?.innerText.includes("mandal needs review")`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4 });
  await cdp.evaluate(`document.querySelector("[data-testid='res-preview-table']")?.scrollIntoView({ block: "start" })`);
  await sleep(200);
  await screenshot(cdp, "win-win-reservations-import-review.png");
  await click(cdp, "[data-testid='res-approve-Tanuku']");
  await waitFor(cdp, `document.querySelector("[data-testid='res-eligible']")?.innerText.includes("Importable 3")`);
  await click(cdp, "[data-testid='res-commit']");
  await waitFor(cdp, `document.querySelector("[data-testid='res-import-summary']")?.innerText.includes("Imported 3")`);
  log("import", await cdp.evaluate(`document.querySelector("[data-testid='res-import-summary']")?.innerText ?? ""`));

  await click(cdp, "[data-testid='res-tab-summary']");
  const summaryElection = await waitFor(
    cdp,
    `document.querySelector("[data-testid='res-election'] option:not([value=''])")?.value ?? ""`
  );
  await fill(cdp, "[data-testid='res-election']", summaryElection);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='res-sarpanch-summary']"))`);
  const noteValue = await waitFor(
    cdp,
    `document.querySelector("[data-testid='res-notification'] option:not([value=''])")?.value ?? ""`
  );
  await fill(cdp, "[data-testid='res-notification']", noteValue);
  await waitFor(cdp, `document.querySelector("[data-testid='res-sarpanch-summary']")?.innerText.includes("UR(W)")`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4 });
  await sleep(150);
  await screenshot(cdp, "win-win-reservations-summary.png");
  await click(cdp, "[data-testid='res-tab-matrix']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='res-matrix']"))`);
  const matrix = await cdp.evaluate(`document.querySelector("[data-testid='res-matrix']")?.innerText ?? ""`);
  if (!matrix.includes("Duvva") || !matrix.includes("UR(W)") || !matrix.includes("BC")) {
    throw new Error(`Matrix missing expected seats: ${matrix}`);
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4 });
  await sleep(150);
  await screenshot(cdp, "win-win-reservations-matrix.png");
  await click(cdp, "[data-testid='res-tab-summary']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='res-export-matrix']"))`);
  await click(cdp, "[data-testid='res-export-matrix']");
  await sleep(600);
  if (!fs.existsSync(EXPORT_FILE)) throw new Error("Reservation export was not written.");
  const exported = fs.readFileSync(EXPORT_FILE, "utf8");
  if (!exported.includes("Duvva")) throw new Error(`Export missing GP: ${exported}`);
  log("export", "matrix CSV written");
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
  await writeReservationFile();
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
  } catch (error) {
    failed = error;
  } finally {
    await stop(child);
  }
  const report = path.join(ARTIFACTS, "win-win-reservations-ui-journey.log");
  fs.writeFileSync(report, steps.concat(failed ? [`FAILED: ${failed instanceof Error ? failed.stack : String(failed)}`] : ["OK"]).join("\n"));
  console.log(fs.readFileSync(report, "utf8"));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
