/** One in-flight download that several `ensureAvailable` calls wait on. */
interface SharedDownload {
  promise: Promise<void>;
  listeners: Set<(fraction: number) => void>;
  last: number;
}

/**
 * Coalesces concurrent downloads of the same key: the first call starts the work, later calls
 * join it, and every caller receives progress (monotonic, clamped to 0…1) until it settles.
 */
export function createSharedDownloads() {
  const inFlight = new Map<string, SharedDownload>();

  return function run(
    key: string,
    start: (emit: (fraction: number) => void) => Promise<void>,
    onProgress: ((fraction: number) => void) | undefined,
  ): Promise<void> {
    let entry = inFlight.get(key);
    if (!entry) {
      const created: SharedDownload = { promise: Promise.resolve(), listeners: new Set(), last: 0 };
      const emit = (raw: number) => {
        if (!Number.isFinite(raw)) return;
        const fraction = Math.min(1, Math.max(0, raw));
        if (fraction < created.last) return;
        created.last = fraction;
        for (const listener of [...created.listeners]) {
          try {
            listener(fraction);
          } catch {
            // A throwing progress callback must not break the download or other callers.
          }
        }
      };
      created.promise = (async () => {
        try {
          await start(emit);
        } finally {
          inFlight.delete(key);
        }
      })();
      inFlight.set(key, created);
      entry = created;
    }
    const joined = entry;
    if (onProgress) joined.listeners.add(onProgress);
    return joined.promise.finally(() => {
      if (onProgress) joined.listeners.delete(onProgress);
    });
  };
}
