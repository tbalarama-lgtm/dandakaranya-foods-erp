/** Yield so Electron can process IPC, cancel flags, and renderer paints. */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export const IMPORT_CHUNK = 250;
