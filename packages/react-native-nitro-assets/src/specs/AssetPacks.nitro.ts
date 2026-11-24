import type { HybridObject } from 'react-native-nitro-modules';
import type { AssetBackend } from './AssetBackend.ts';
import type { AssetPackStatus } from './AssetPackStatus.ts';

/**
 * The native asset-pack backend. Private to `react-native-nitro-assets/native`: apps use
 * {@linkcode AssetsClient} from `createAssets`. Every method rejects with an `Error` whose message
 * starts with `[nitro-assets:<code>]`.
 *
 * iOS 26+ with Background Assets configured uses `AssetPackManager`; iOS below 26 uses
 * `NSBundleResourceRequest`; Android uses Play Asset Delivery. Files of a pack live under
 * `<packId>/` in the backend's namespace.
 */
export interface AssetPacks extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** The backend this device uses; `none` when nothing is configured. */
  readonly backend: AssetBackend;
  getStatus(packId: string): Promise<AssetPackStatus>;
  ensureAvailable(
    packId: string,
    requireLatestVersion: boolean,
    onProgress?: (fraction: number) => void,
  ): Promise<void>;
  /** A `file://` URL of `relativePath` inside the pack; rejects when the pack is not local. */
  getFileUrl(packId: string, relativePath: string): Promise<string>;
  remove(packId: string): Promise<void>;
}
