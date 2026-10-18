#!/usr/bin/env node
import process from "node:process";
import { resolvePackageFile, spawnNode } from "./process-helpers.mjs";

const extra = process.argv.slice(2);
const electronVite = resolvePackageFile("electron-vite/bin/electron-vite.js");
const child = spawnNode(electronVite, ["dev", ...extra]);
child.on("exit", (code) => process.exit(code ?? 1));
