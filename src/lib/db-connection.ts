import { prisma } from "./db";

const CONNECTION_ERROR_MARKERS = [
  "Can't reach database server",
  "P1001",
  "P1017",
  "P2024",
  "Connection terminated",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "PrismaClientInitializationError",
  "connection pool",
  "Timed out fetching a new connection",
];

export function isPrismaConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  const code = "code" in error ? String(error.code) : "";
  const blob = `${name} ${message} ${code}`;
  return CONNECTION_ERROR_MARKERS.some((m) => blob.includes(m));
}

/** Quick connectivity check before firing many parallel queries. */
export async function pingDatabase(retries = 2): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }
  return false;
}

/**
 * Run Prisma calls in small parallel batches so Supabase PgBouncer (port 6543) is not flooded.
 */
export async function runQueriesInBatches<T extends readonly unknown[]>(
  factories: { [K in keyof T]: () => Promise<T[K]> },
  concurrency = 6,
): Promise<T> {
  const results: unknown[] = [];
  const list = factories as ReadonlyArray<() => Promise<unknown>>;

  for (let i = 0; i < list.length; i += concurrency) {
    const chunk = list.slice(i, i + concurrency);
    const settled = await Promise.all(chunk.map((fn) => fn()));
    results.push(...settled);
  }

  return results as T;
}

/** Run a count query; returns fallback on connection errors. */
export async function safeCount(
  fn: () => Promise<number>,
  fallback = 0,
): Promise<number> {
  try {
    return await fn();
  } catch (error) {
    if (isPrismaConnectionError(error)) return fallback;
    throw error;
  }
}
