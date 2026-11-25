import type { AssetsAdapter } from './AssetsAdapter.ts';
import type { EnsureAvailableOptions } from './EnsureAvailableOptions.ts';
import type { AssetBackend } from './specs/AssetBackend.ts';
import type { AssetPackStatus } from './specs/AssetPackStatus.ts';

/**
 * Asset packs on this device, created by {@linkcode createAssets}. Every method is async and
 * rejects with an {@linkcode AssetsError}; none of them waits forever.
 *
 * A pack's files keep the layout they had when the pack was built: `getFileUrl('intent-model',
 * 'tokenizer.json')` reads `tokenizer.json` from the root of the `intent-model` pack.
 *
 * @example
 * ```ts
 * const assets = createAssets({ adapter: createNativeAdapter() });
 * await assets.ensureAvailable('intent-model', { onProgress: setProgress });
 * const modelUrl = await assets.getFileUrl('intent-model', 'model.pte');
 * ```
 */
export interface AssetsClient {
  /** The adapter's name, for example `native` or `memory`. @see {@linkcode AssetsAdapter.name} */
  readonly adapter: AssetsAdapter['name'];
  /** The system that delivers packs on this device. @see {@linkcode AssetBackend} */
  readonly backend: AssetBackend;
  /**
   * Whether packs can be delivered here. When `false`, every call rejects with the reason
   * (`unsupported_platform`, `unsupported_os` or `misconfigured`).
   */
  readonly isSupported: boolean;

  /**
   * Whether a pack is on the device, downloading or not downloaded, and whether an update exists.
   *
   * @throws {@linkcode AssetsError} `pack_not_found` when the store does not know the pack.
   */
  getStatus(packId: string): Promise<AssetPackStatus>;

  /**
   * Resolves once the pack is on the device, downloading it first when needed. Resolves at once
   * when it is already there. Concurrent calls for the same pack share one download; each gets
   * its own progress.
   *
   * Essential packs (Background Assets) and install-time or fast-follow packs (Play) usually
   * arrive with the app, but network drops can leave them missing: call this before every read.
   *
   * @throws {@linkcode AssetsError} `pack_not_found`, `network`, `insufficient_storage`,
   *   `store_unavailable`, `user_confirmation_required`, `not_allowed` or `timeout`.
   */
  ensureAvailable(packId: string, options?: EnsureAvailableOptions): Promise<void>;

  /**
   * A `file://` URL for `relativePath` inside a pack that is on the device, for libraries that
   * load files by URL (react-native-executorch, ONNX Runtime, media players). Use it in this
   * process only: the location can change after a restart or an update.
   *
   * @param relativePath A path inside the pack, without a leading `/` and without `..`.
   * @throws {@linkcode AssetsError} `pack_not_downloaded` when the pack is not local (call
   *   {@linkcode AssetsClient.ensureAvailable} first), `file_not_found` when the pack has no such file.
   */
  getFileUrl(packId: string, relativePath: string): Promise<string>;

  /**
   * Deletes a downloaded pack from the device to free space. A later
   * {@linkcode AssetsClient.ensureAvailable} downloads it again. Resolves when the pack was not
   * on the device. Install-time Play packs are part of the app and cannot be removed.
   */
  remove(packId: string): Promise<void>;
}
