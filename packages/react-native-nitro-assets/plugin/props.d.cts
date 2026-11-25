/** Download policy of an Apple-hosted pack, written into its manifest by `nitro-assets package`. */
export type BackgroundAssetsPolicy = 'essential' | 'prefetch' | 'on-demand';
/** On-Demand Resources tag category: downloaded with the app, right after it, or on request. */
export type OnDemandResourcesPolicy = 'initial-install' | 'prefetch' | 'on-demand';
/** Play Asset Delivery mode. */
export type PlayAssetDeliveryType = 'install-time' | 'fast-follow' | 'on-demand';

/** Options of the `react-native-nitro-assets` Expo config plugin. */
export interface NitroAssetsPluginProps {
  /**
   * Where each pack's files are, relative to the project root. Its contents become the pack root:
   * `packs['intent-model'].path = 'asset-packs/intent-model'` makes
   * `asset-packs/intent-model/tokenizer.json` readable as `getFileUrl('intent-model', 'tokenizer.json')`.
   * Needed for ODR and Play packs (bundled into the build) and for `nitro-assets package`.
   */
  packs?: Record<string, { path: string } | string>;
  ios?: {
    /**
     * Apple-hosted Background Assets (iOS 26+). Adds `BAAppGroupID`, `BAHasManagedAssetPacks`,
     * `BAUsesAppleHosting` and the app group entitlement. The downloader extension target comes
     * from expo-native-config (`{ package: 'react-native-nitro-assets/downloader' }`).
     * Omit or set `false` to turn off.
     */
    backgroundAssets?:
      | false
      | {
          /** App group shared by the app and the downloader extension. Default `group.<bundleIdentifier>`. */
          appGroupId?: string;
          /** Download policy per pack, used by `nitro-assets package`. Default `on-demand`. */
          packs?: Record<string, BackgroundAssetsPolicy>;
        };
    /**
     * On-Demand Resources fallback for iOS below 26: tags each pack's folder and bundles it with
     * the build. Omit or set `false` to turn off.
     */
    odr?: false | { packs: Record<string, OnDemandResourcesPolicy> };
  };
  android?: {
    /**
     * Google Play Asset Delivery: one asset-pack Gradle module per pack (`-` becomes `_` in the
     * Android pack name). Omit or set `false` to turn off.
     */
    playAssetDelivery?: false | { packs: Record<string, PlayAssetDeliveryType> };
  };
}

export interface ResolvedNitroAssetsPluginProps {
  packs: Record<string, { path: string }>;
  ios: {
    backgroundAssets?: { appGroupId: string; packs: Record<string, BackgroundAssetsPolicy> };
    odr?: { packs: Record<string, OnDemandResourcesPolicy> };
  };
  android: { playAssetDelivery?: { packs: Record<string, PlayAssetDeliveryType> } };
}

export function resolveProps(
  props: unknown,
  ios?: { bundleIdentifier?: string },
): ResolvedNitroAssetsPluginProps;

export function androidPackName(packId: string): string;
