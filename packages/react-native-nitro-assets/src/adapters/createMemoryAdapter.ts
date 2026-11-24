import type { AssetsAdapter } from '../AssetsAdapter.ts';
import { AssetsError, type AssetsErrorCode } from '../AssetsError.ts';
import type { AssetPackState } from '../specs/AssetPackState.ts';
import type { AssetPackStatus } from '../specs/AssetPackStatus.ts';

/**
 * One pack served by {@linkcode createMemoryAdapter}.
 */
export interface MemoryPack {
  /** Paths of the files in the pack, relative to its root (for example `model.pte`). */
  files: readonly string[];
  /**
   * Whether the pack starts on the device.
   * @default false
   */
  isDownloaded?: boolean;
  /** Reported as {@linkcode AssetPackStatus.downloadSizeBytes}. */
  downloadSizeBytes?: number;
  /**
   * How long a simulated download takes, in milliseconds. Progress is reported in ten steps.
   * @default 1000
   */
  downloadDurationMs?: number;
  /** Makes every download of this pack fail with this code (to exercise error paths). */
  failDownloadWith?: AssetsErrorCode;
}

/**
 * Options for {@linkcode createMemoryAdapter}.
 */
export interface MemoryAdapterOptions {
  /** The packs the simulated store knows, by pack id. */
  packs: Readonly<Record<string, MemoryPack>>;
  /**
   * Prefix of the URLs `getFileUrl` returns: `<baseUrl><packId>/<path>`.
   * @default 'memory://'
   */
  baseUrl?: string;
}

/**
 * An in-memory asset store for tests, the web and the example app: packs "download" on a timer,
 * report progress, and resolve file URLs under `baseUrl`. Nothing touches the disk or network.
 *
 * @example
 * ```ts
 * const assets = createAssets({
 *   adapter: createMemoryAdapter({
 *     packs: { 'intent-model': { files: ['model.pte', 'tokenizer.json'], downloadSizeBytes: 124e6 } },
 *   }),
 * });
 * ```
 */
export function createMemoryAdapter(options: MemoryAdapterOptions): AssetsAdapter {
  const baseUrl = options.baseUrl ?? 'memory://';
  const states = new Map<string, AssetPackState>();
  for (const [packId, pack] of Object.entries(options.packs))
    states.set(packId, pack.isDownloaded ? 'available' : 'not-downloaded');

  const find = (packId: string): MemoryPack => {
    const pack = options.packs[packId];
    if (!pack) throw new AssetsError('pack_not_found', `No asset pack "${packId}"`, { packId });
    return pack;
  };

  return {
    name: 'memory',
    backend: 'memory',
    isSupported: true,

    async getStatus(packId): Promise<AssetPackStatus> {
      const pack = find(packId);
      const status: AssetPackStatus = {
        packId,
        state: states.get(packId) ?? 'not-downloaded',
        isUpdateAvailable: false,
      };
      if (pack.downloadSizeBytes !== undefined) status.downloadSizeBytes = pack.downloadSizeBytes;
      return status;
    },

    async ensureAvailable(packId, { onProgress }) {
      const pack = find(packId);
      if (states.get(packId) === 'available') return;
      states.set(packId, 'downloading');
      const steps = 10;
      const stepMs = (pack.downloadDurationMs ?? 1000) / steps;
      try {
        for (let step = 1; step <= steps; step++) {
          await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
          if (pack.failDownloadWith && step === steps / 2)
            throw new AssetsError(pack.failDownloadWith, `Simulated failure: ${pack.failDownloadWith}`, {
              packId,
            });
          onProgress?.(step / steps);
        }
        states.set(packId, 'available');
      } catch (error) {
        states.set(packId, 'not-downloaded');
        throw error;
      }
    },

    async getFileUrl(packId, relativePath) {
      const pack = find(packId);
      if (states.get(packId) !== 'available')
        throw new AssetsError('pack_not_downloaded', `Asset pack "${packId}" is not on the device`, {
          packId,
        });
      if (!pack.files.includes(relativePath))
        throw new AssetsError('file_not_found', `Asset pack "${packId}" has no file "${relativePath}"`, {
          packId,
        });
      return `${baseUrl}${packId}/${relativePath}`;
    },

    async remove(packId) {
      find(packId);
      states.set(packId, 'not-downloaded');
    },
  };
}
