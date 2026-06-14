/** Run a Prisma query; return fallback if the table/column is missing (pre-migration). */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[safeQuery]", e);
    return fallback;
  }
}
