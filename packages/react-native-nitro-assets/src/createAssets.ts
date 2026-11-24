import type { AssetsClient } from './AssetsClient.ts';
import { AssetsError, toAssetsError } from './AssetsError.ts';
import type { AssetsOptions } from './AssetsOptions.ts';
import { withDeadline } from './internal/deadline.ts';
import { createSharedDownloads } from './internal/sharedDownloads.ts';
import { checkPackId, checkRelativePath, checkTimeout } from './internal/validation.ts';

/** Default deadline of the quick calls (`getStatus`, `getFileUrl`, `remove`). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Creates an {@linkcode AssetsClient} over an adapter. Checks the options now (throws
 * {@linkcode AssetsError} `invalid_argument`), then validates every call's arguments, bounds the
 * quick calls with a deadline, shares concurrent downloads of a pack and maps every failure to an
 * {@linkcode AssetsError}.
 *
 * @example
 * ```ts
 * import { createAssets } from 'react-native-nitro-assets';
 * import { createNativeAdapter } from 'react-native-nitro-assets/native';
 *
 * export const assets = createAssets({ adapter: createNativeAdapter() });
 * ```
 */
export function createAssets(options: AssetsOptions): AssetsClient {
  const { adapter } = options;
  if (!adapter || typeof adapter.getStatus !== 'function')
    throw new AssetsError('invalid_argument', 'createAssets needs an adapter');
  checkTimeout('timeoutMs', options.timeoutMs);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const downloads = createSharedDownloads();

  async function call<T>(what: string, packId: string, body: () => Promise<T>, ms: number | undefined) {
    try {
      return await withDeadline(body(), ms, what, packId);
    } catch (error) {
      throw toAssetsError(error, packId);
    }
  }

  return {
    adapter: adapter.name,
    get backend() {
      return adapter.backend;
    },
    get isSupported() {
      return adapter.isSupported;
    },

    async getStatus(packId) {
      checkPackId(packId);
      return call(`getStatus(${packId})`, packId, () => adapter.getStatus(packId), timeoutMs);
    },

    async ensureAvailable(packId, ensureOptions = {}) {
      checkPackId(packId);
      checkTimeout('timeoutMs', ensureOptions.timeoutMs);
      const requireLatestVersion = ensureOptions.requireLatestVersion ?? false;
      const shared = downloads(
        `${packId}\u0000${requireLatestVersion}`,
        (emit) => adapter.ensureAvailable(packId, { requireLatestVersion, onProgress: emit }),
        ensureOptions.onProgress,
      );
      return call(`ensureAvailable(${packId})`, packId, () => shared, ensureOptions.timeoutMs);
    },

    async getFileUrl(packId, relativePath) {
      checkPackId(packId);
      checkRelativePath(relativePath, packId);
      return call(
        `getFileUrl(${packId}, ${relativePath})`,
        packId,
        () => adapter.getFileUrl(packId, relativePath),
        timeoutMs,
      );
    },

    async remove(packId) {
      checkPackId(packId);
      return call(`remove(${packId})`, packId, () => adapter.remove(packId), timeoutMs);
    },
  };
}
