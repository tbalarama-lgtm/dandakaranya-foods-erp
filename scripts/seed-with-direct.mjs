/**
 * Runs prisma/seed.ts using the best available Supabase connection.
 * Tries DIRECT_URL (:5432) first, then DATABASE_URL pooler (:6543).
 */
import { execSync } from "node:child_process";

function parsePostgresUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:") return null;
    if (!parsed.hostname || parsed.hostname === "supabase.com") return null;
    return parsed;
  } catch {
    return null;
  }
}

function urlForSeed(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("connection_limit");
  parsed.searchParams.set("connect_timeout", "30");
  if (parsed.port === "6543" && !parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true");
  }
  return parsed.toString();
}

function runSeed(label, url) {
  process.env.DATABASE_URL = url;
  console.log(`[seed] Trying ${label}…`);
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
}

const directUrl = process.env.DIRECT_URL?.trim();
const poolerUrl = process.env.DATABASE_URL?.trim();

if (!parsePostgresUrl(directUrl) && !parsePostgresUrl(poolerUrl)) {
  console.error(
    "Invalid database URL. Copy both URIs from Supabase → Connect → ORMs → Prisma into .env.local:\n" +
      "  DATABASE_URL  → pooler :6543  (?pgbouncer=true&connection_limit=1)\n" +
      "  DIRECT_URL    → session  :5432",
  );
  process.exit(1);
}

const attempts = [];
if (directUrl && parsePostgresUrl(directUrl)) {
  attempts.push(["DIRECT_URL (:5432)", urlForSeed(directUrl)]);
}
if (poolerUrl && parsePostgresUrl(poolerUrl)) {
  attempts.push(["DATABASE_URL pooler (:6543)", urlForSeed(poolerUrl)]);
}

let lastError;
for (const [label, url] of attempts) {
  try {
    runSeed(label, url);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(`[seed] ${label} failed, trying next connection…`);
  }
}

console.error("[seed] All connection attempts failed.");
if (lastError) throw lastError;
process.exit(1);
