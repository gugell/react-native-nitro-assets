import type { AssetBackend } from './specs/AssetBackend.ts';
import type { AssetPackStatus } from './specs/AssetPackStatus.ts';

/**
 * A backend {@linkcode createAssets} talks to: the native module
 * (`react-native-nitro-assets/native`), the in-memory adapter (`/memory`), or your own.
 *
 * Adapters receive validated arguments and reject with an {@linkcode AssetsError}, or an `Error`
 * whose message contains `[nitro-assets:<code>]`; the client maps both.
 */
export interface AssetsAdapter {
  /** Shown in errors and diagnostics, for example `native` or `memory`. */
  readonly name: string;
  /** The system that delivers packs through this adapter on this device. */
  readonly backend: AssetBackend;
  /** Whether this adapter can deliver packs on this device right now. */
  readonly isSupported: boolean;
  getStatus(packId: string): Promise<AssetPackStatus>;
  ensureAvailable(
    packId: string,
    options: { requireLatestVersion: boolean; onProgress?: (fraction: number) => void },
  ): Promise<void>;
  getFileUrl(packId: string, relativePath: string): Promise<string>;
  remove(packId: string): Promise<void>;
}
