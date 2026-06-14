const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const targets = [
  ".next/node_modules",
  ".next/standalone/node_modules",
  ".next/standalone/.next/node_modules",
];

function materializeLink(fullPath) {
  if (!fs.existsSync(fullPath)) return;
  let stat;
  try {
    stat = fs.lstatSync(fullPath);
  } catch {
    return;
  }
  if (!stat.isSymbolicLink()) return;

  const linkTarget = fs.readlinkSync(fullPath);
  const resolved = path.isAbsolute(linkTarget)
    ? linkTarget
    : path.resolve(path.dirname(fullPath), linkTarget);
  if (!fs.existsSync(resolved)) return;

  console.log("[netlify-prep] Materializing " + fullPath.replace(root, "."));
  fs.rmSync(fullPath, { recursive: true, force: true });
  fs.cpSync(resolved, fullPath, { recursive: true, dereference: true });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    if (fs.lstatSync(fullPath).isSymbolicLink()) {
      materializeLink(fullPath);
      continue;
    }
    if (fs.statSync(fullPath).isDirectory()) walk(fullPath);
  }
}

let count = 0;
for (const rel of targets) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  walk(full);
  count += 1;
}

console.log(
  count
    ? "[netlify-prep] Traced node_modules ready for Netlify deploy."
    : "[netlify-prep] No traced node_modules folders found under .next/",
);
