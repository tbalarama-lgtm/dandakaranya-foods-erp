#!/usr/bin/env node
/**
 * Isolated UI journey for Organization Posts: overview, units, posts, holders, vacancies.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { electronBinary, root } from "./process-helpers.mjs";

const ARTIFACTS = process.env.WINWIN_UI_ARTIFACTS ?? "/opt/cursor/artifacts";
const PROFILE = process.env.WINWIN_TEST_PROFILE ?? path.join(os.tmpdir(), `win-win-org-posts-ui-${Date.now()}`);
const CDP_PORT = Number(process.env.WINWIN_CDP_PORT ?? "9228");
const LABEL = "[TEST-ORG]";
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
  const args = [path.join(root, "out", "main", "index.js"), `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${CDP_PORT}`];
  if (process.platform === "linux") args.push("--no-sandbox", "--disable-gpu");
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return spawn(electronBinary(), args, {
    stdio: ["ignore", "ignore", fs.openSync(path.join(ARTIFACTS, "win-win-org-posts-electron-stderr.log"), "a")],
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
  return cdp.evaluate(`(${FILL})(${JSON.stringify(selector)}, ${JSON.stringify(value)})`);
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

async function drive(cdp) {
  await ready(cdp);
  await click(cdp, '[data-testid="nav-settings"]');
  await waitFor(cdp, `Boolean(document.querySelector("#constituency-name"))`);
  await fill(cdp, "#constituency-name", `${LABEL} Seat`);
  await click(cdp, "#constituency-create");
  await waitFor(cdp, `document.querySelector("#topbar-constituency")?.innerText.includes("Seat")`);
  await fill(cdp, "#boundary-name", `${LABEL} Boundaries`);
  await click(cdp, "#boundary-create");
  await waitFor(cdp, `document.querySelector("#topbar-boundary")?.innerText.includes("Boundaries")`);

  await click(cdp, '[data-testid="nav-org-posts"]');
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='org-name']"))`);
  await fill(cdp, "[data-testid='org-name']", "Civic Forum");
  await click(cdp, "[data-testid='org-create']");
  await waitFor(cdp, `Array.from(document.querySelector("[data-testid='org-select']")?.options ?? []).some(o => o.text.includes("Civic Forum"))`);
  const orgId = await cdp.evaluate(`Array.from(document.querySelector("[data-testid='org-select']").options).find(o => o.text.includes("Civic Forum")).value`);
  await fill(cdp, "[data-testid='org-select']", orgId);
  await waitFor(cdp, `document.querySelector("[data-testid='org-stat-units']")?.textContent === "0"`);
  await screenshot(cdp, "win-win-org-overview.png");

  await click(cdp, "[data-testid='org-tab-units']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='org-unit-name']"))`);
  await fill(cdp, "[data-testid='org-wing-name']", "Youth wing");
  await cdp.evaluate(`document.querySelector("[data-testid='org-wing-name']").closest("form").requestSubmit(); true;`);
  await fill(cdp, "[data-testid='org-unit-name']", "Mandal committee");
  await fill(cdp, "[data-testid='org-unit-level']", "mandal");
  await click(cdp, "[data-testid='org-unit-create']");
  await waitFor(cdp, `document.body.innerText.includes("Mandal committee")`);
  await screenshot(cdp, "win-win-org-units.png");

  await click(cdp, "[data-testid='org-tab-posts']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='org-post-title']"))`);
  const unitId = await waitFor(cdp, `document.querySelector("[data-testid='org-post-unit']")?.options[1]?.value`);
  await fill(cdp, "[data-testid='org-post-unit']", unitId);
  await fill(cdp, "[data-testid='org-post-title']", "Secretary");
  await fill(cdp, "[data-testid='org-post-authorized']", "1");
  await click(cdp, "[data-testid='org-post-create']");
  await waitFor(cdp, `document.body.innerText.includes("Secretary")`);

  await click(cdp, "[data-testid='org-tab-holders']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='org-appt-name']"))`);
  const postId = await waitFor(cdp, `document.querySelector("[data-testid='org-appt-post']")?.options[1]?.value`);
  await fill(cdp, "[data-testid='org-appt-post']", postId);
  await fill(cdp, "[data-testid='org-appt-name']", "Asha Rao");
  await fill(cdp, "[data-testid='org-appt-start']", "2026-01-15");
  await click(cdp, "[data-testid='org-appt-create']");
  await waitFor(
    cdp,
    `document.body.innerText.includes("Asha Rao") || Boolean(document.querySelector("[data-testid='app-error']"))`
  );
  const apptError = await cdp.evaluate(`document.querySelector("[data-testid='app-error']")?.innerText ?? ""`);
  if (apptError) throw new Error("Appointment create failed: " + apptError);
  await screenshot(cdp, "win-win-org-holders.png");

  await click(cdp, "[data-testid='org-tab-vacancies']");
  await waitFor(cdp, `document.body.innerText.includes("Status unknown") || document.body.innerText.includes("Verified vacancy")`);
  await screenshot(cdp, "win-win-org-vacancies.png");

  await click(cdp, "[data-testid='org-tab-structure']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='org-tree']"))`);
  await screenshot(cdp, "win-win-org-structure.png");

  await click(cdp, "[data-testid='nav-dashboard']");
  await waitFor(cdp, `Boolean(document.querySelector("[data-testid='geo-org-posts']"))`);
  await cdp.evaluate(`document.querySelector("[data-testid='geo-org-posts']")?.scrollIntoView({ block: "center" }); true;`);
  await sleep(300);
  await screenshot(cdp, "win-win-org-geo-association.png");
  log("journey", "organization overview, units, posts, holders, vacancies, structure, geo association");
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
  const report = path.join(ARTIFACTS, "win-win-org-posts-ui-journey.log");
  fs.writeFileSync(report, steps.concat(failed ? [`FAILED: ${failed instanceof Error ? failed.stack : String(failed)}`] : ["OK"]).join("\n"));
  console.log(fs.readFileSync(report, "utf8"));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
