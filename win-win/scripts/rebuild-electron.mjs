#!/usr/bin/env node
import process from "node:process";
import { electronBuilderInstallAppDeps } from "./process-helpers.mjs";

console.log("Rebuilding native modules for the bundled Electron ABI…");
process.exit(electronBuilderInstallAppDeps());
