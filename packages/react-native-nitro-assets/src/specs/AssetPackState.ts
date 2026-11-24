/**
 * Where an asset pack is, as reported in {@linkcode AssetPackStatus.state}.
 *
 * - `available`: on the device and readable now ({@linkcode AssetsClient.getFileUrl} works).
 * - `downloading`: the system is downloading it (for example an essential pack right after install).
 * - `not-downloaded`: known to the store but not on the device; {@linkcode AssetsClient.ensureAvailable}
 *   downloads it.
 */
export type AssetPackState = 'available' | 'downloading' | 'not-downloaded';
