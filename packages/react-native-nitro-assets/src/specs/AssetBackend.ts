/**
 * The system that delivers asset packs to this device, as reported by
 * {@linkcode AssetsClient.backend}.
 *
 * - `background-assets`: Apple-hosted Background Assets (iOS 26+).
 * - `on-demand-resources`: On-Demand Resources, Apple's older system (iOS below 26).
 * - `play-asset-delivery`: Google Play Asset Delivery (Android).
 * - `memory`: the in-memory adapter (tests, web, the example app).
 * - `none`: no backend is configured or available; every call rejects.
 *
 * @see {@linkcode AssetsAdapter.backend}
 */
export type AssetBackend =
  | 'background-assets'
  | 'on-demand-resources'
  | 'play-asset-delivery'
  | 'memory'
  | 'none';
