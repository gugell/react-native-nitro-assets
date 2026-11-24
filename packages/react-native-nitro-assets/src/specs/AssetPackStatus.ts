import type { AssetPackState } from './AssetPackState.ts';

/**
 * The status of one asset pack, as returned by {@linkcode AssetsClient.getStatus}.
 */
export interface AssetPackStatus {
  /** The pack's identifier, as passed to {@linkcode AssetsClient.getStatus}. */
  packId: string;
  /** Whether the pack is on the device, downloading, or not downloaded. */
  state: AssetPackState;
  /**
   * Whether the store has a newer version than the one on the device. Pass
   * `requireLatestVersion: true` to {@linkcode AssetsClient.ensureAvailable} to download it.
   * Always `false` on backends without pack versions (On-Demand Resources, Play Asset Delivery).
   */
  isUpdateAvailable: boolean;
  /**
   * Download size in bytes, when the backend reports it (Background Assets and Play Asset
   * Delivery do; On-Demand Resources does not).
   */
  downloadSizeBytes?: number;
}
