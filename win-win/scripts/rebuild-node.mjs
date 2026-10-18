#!/usr/bin/env node
import process from "node:process";
import { npmRebuildSqlite } from "./process-helpers.mjs";

console.log("Rebuilding better-sqlite3 for this Node.js ABI (tests only)…");
process.exit(npmRebuildSqlite());
