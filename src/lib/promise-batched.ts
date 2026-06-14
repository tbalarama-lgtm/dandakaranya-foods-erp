/**
 * Run async tasks in small batches so Prisma does not exhaust a small pool
 * (e.g. Supabase `connection_limit=1` on DATABASE_URL).
 */
export async function promiseAllBatched<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 4,
): Promise<T[]> {
  const size = Math.max(1, concurrency);
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const chunk = tasks.slice(i, i + size);
    const chunkResults = await Promise.all(chunk.map((fn) => fn()));
    results.push(...chunkResults);
  }
  return results;
}

/** Matches typical Supabase pooler `connection_limit` in DATABASE_URL (default 4). */
export function prismaQueryConcurrency(): number {
  const fromEnv = process.env.PRISMA_QUERY_CONCURRENCY;
  if (fromEnv) {
    const n = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const url = process.env.DATABASE_URL ?? "";
  const match = url.match(/connection_limit=(\d+)/i);
  if (match) {
    const limit = Number.parseInt(match[1], 10);
    if (limit <= 1) return 1;
    return Math.min(limit, 6);
  }
  return 4;
}
