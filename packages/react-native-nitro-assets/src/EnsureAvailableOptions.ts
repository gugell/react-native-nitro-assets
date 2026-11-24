/**
 * Options for {@linkcode AssetsClient.ensureAvailable}.
 */
export interface EnsureAvailableOptions {
  /**
   * Called with the download progress, from 0 to 1, while the pack downloads. Values only
   * increase. Not called when the pack is already on the device.
   */
  onProgress?: (fraction: number) => void;
  /**
   * Also download a newer version when one exists, instead of accepting the version on the
   * device. Background Assets only; other backends ignore it.
   * @default false
   */
  requireLatestVersion?: boolean;
  /**
   * Give up after this many milliseconds and reject with `timeout`. The system may keep
   * downloading in the background; a later call picks the download up.
   * @default undefined (no limit: a 119 MB model on a slow network can take minutes)
   */
  timeoutMs?: number;
}
