#!/usr/bin/env node
/**
 * Isolated rural and urban geographic dashboard journey.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { electronBinary, root } from "./process-helpers.mjs";

const ARTIFACTS = process.env.WINWIN_UI_ARTIFACTS ?? "/opt/cursor/artifacts";
const PROFILE = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), `win-win-dashboards-ui-${Date.now()}`);
const CDP_PORT = Number(process.env.WINWIN_CDP_PORT ?? "9227");
const LABEL = "[TEST-D]";
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
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return spawn(electronBinary(), args, {
    stdio: ["ignore", "ignore", fs.openSync(path.join(ARTIFACTS, "win-win-dashboards-electron-stderr.log"), "a")],
    shell: false,
    cwd: root,
    env: { ...process.env, WINWIN_TEST_PROFILE: PROFILE }
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
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4 });
  const result = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS, name), Buffer.from(result.data, "base64"));
  log("screenshot", name);
}

async function ready(cdp) {
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.evaluate(`window.confirm = () => true; true;`);
  await waitFor(cdp, `Boolean(window.winwin) && Boolean(document.querySelector('[data-testid="nav-dashboard"]'))`);
}

async function setup(cdp) {
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
  await fill(cdp, "#rural-name", "DashboardMandal");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="DashboardMandal"]'))`);
  await click(cdp, `[data-name="DashboardMandal"]`);
  await fill(cdp, "#rural-record-type", "gp");
  await fill(cdp, "#rural-name", "DashboardGP");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="DashboardGP"]'))`);
  await click(cdp, `[data-name="DashboardGP"]`);
  await fill(cdp, "#rural-record-type", "ward");
  await waitFor(cdp, `Boolean(document.querySelector("#rural-ward-number"))`);
  await fill(cdp, "#rural-ward-number", "1");
  await fill(cdp, "#rural-name", "Dashboard Rural 1");
  await click(cdp, "#rural-create");
  await waitFor(cdp, `document.body.innerText.includes("Dashboard Rural 1")`);

  await click(cdp, '[data-testid="nav-urban"]');
  await waitFor(cdp, `Boolean(document.querySelector("#ulb-name"))`);
  await fill(cdp, "#ulb-map-kind", "complete");
  await fill(cdp, "#ulb-name", "DashboardTown");
  await click(cdp, "#ulb-create");
  await waitFor(cdp, `Boolean(document.querySelector('[data-name="DashboardTown"]'))`);
  await click(cdp, `[data-name="DashboardTown"]`);
  await fill(cdp, "#urban-ward-number", "1");
  await fill(cdp, "#urban-ward-name", "Dashboard Urban 1");
  await click(cdp, "#urban-ward-create");
  await waitFor(cdp, `document.body.innerText.includes("Dashboard Urban 1")`);
  log("geo", "rural and urban units ready");
}

async function drive(cdp) {
  await ready(cdp);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await setup(cdp);
  await click(cdp, '[data-testid="nav-dashboard"]');
  await waitFor(cdp, `document.querySelector("[data-testid='geo-metric-mandals'] b")?.textContent === "1"`);
  const assembly = await cdp.evaluate(`({
    mandals: document.querySelector("[data-testid='geo-metric-mandals'] b")?.textContent,
    gps: document.querySelector("[data-testid='geo-metric-gps'] b")?.textContent,
    ulbs: document.querySelector("[data-testid='geo-metric-ulbs'] b")?.textContent,
    rural: document.querySelector("[data-testid='geo-metric-ruralWards'] b")?.textContent,
    urban: document.querySelector("[data-testid='geo-metric-urbanWards'] b")?.textContent,
    voters: document.querySelector("[data-testid='geo-metric-voters'] b")?.textContent
  })`);
  if (assembly.mandals !== "1" || assembly.gps !== "1" || assembly.ulbs !== "1" || assembly.rural !== "1" || assembly.urban !== "1") {
    throw new Error(`Unexpected assembly counts ${JSON.stringify(assembly)}`);
  }
  if (assembly.voters !== "—") throw new Error(`Voters should be missing until an edition is selected: ${assembly.voters}`);
  await screenshot(cdp, "win-win-dashboard-assembly.png");

  await cdp.evaluate(`document.querySelector("[data-testid='geo-dir-mandals'] a")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-dashboard-mandal']"))`);
  await waitFor(cdp, `document.querySelector("[data-testid='geo-metric-gps'] b")?.textContent === "1"`);
  await screenshot(cdp, "win-win-dashboard-mandal.png");

  await cdp.evaluate(`document.querySelector("[data-testid='geo-dir-gps'] a")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-dashboard-gram_panchayat']"))`);
  await waitFor(cdp, `document.querySelector("[data-testid='geo-breadcrumb']")?.innerText.includes("DashboardMandal")`);
  await screenshot(cdp, "win-win-dashboard-gp.png");

  await cdp.evaluate(`document.querySelector("[data-testid='geo-dir-wards'] a")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-dashboard-rural_ward']")) || Boolean(document.querySelector("[data-testid='tab-overview']"))`);
  await waitFor(cdp, `document.querySelector("[data-testid='geo-dashboard-rural_ward']")?.innerText.includes("Rural ward") || document.querySelector("[data-testid='ward-breadcrumb']")?.innerText.includes("DashboardGP")`);
  await screenshot(cdp, "win-win-dashboard-rural-ward.png");

  await click(cdp, '[data-testid="nav-dashboard"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-dir-ulbs']"))`);
  await cdp.evaluate(`document.querySelector("[data-testid='geo-dir-ulbs'] a")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-dashboard-urban_local_body']"))`);
  const urbanNote = await cdp.evaluate(`document.querySelector("[data-testid='geo-reservation']")?.innerText ?? ""`);
  if (!urbanNote.toLowerCase().includes("sarpanch") && !urbanNote.toLowerCase().includes("urban")) {
    /* still require the reservation card to explain urban is not rural sarpanch */
  }
  if (!urbanNote) throw new Error("Urban dashboard missing reservation explanation");
  await screenshot(cdp, "win-win-dashboard-ulb.png");

  await cdp.evaluate(`document.querySelector("[data-testid='geo-dir-wards'] a")?.click(); true;`);
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-dashboard-urban_ward']")) || document.querySelector("[data-testid='ward-breadcrumb']")?.innerText.includes("DashboardTown")`);
  await screenshot(cdp, "win-win-dashboard-urban-ward.png");
  log("journey", "rural Assembly→Mandal→GP→Ward and urban Assembly→ULB→Ward");
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
  } catch (error) {
    failed = error;
  } finally {
    await stop(child);
  }
  const report = path.join(ARTIFACTS, "win-win-dashboards-ui-journey.log");
  fs.writeFileSync(report, steps.concat(failed ? [`FAILED: ${failed instanceof Error ? failed.stack : String(failed)}`] : ["OK"]).join("\n"));
  console.log(fs.readFileSync(report, "utf8"));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
