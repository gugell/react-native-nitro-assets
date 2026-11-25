'use strict';

const {
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withSettingsGradle,
  withXcodeProject,
} = require('expo/config-plugins');
const { resolveProps } = require('./props.cjs');
const ios = require('./ios.cjs');
const android = require('./android.cjs');
const pkg = require('../package.json');

/**
 * Expo config plugin for react-native-nitro-assets. Emits only what is enabled:
 *
 * - `ios.backgroundAssets`: `BAAppGroupID`, `BAHasManagedAssetPacks`, `BAUsesAppleHosting` and the
 *   app group entitlement. The app group is also set on `ios.entitlements`, so the downloader
 *   extension that expo-native-config adds inherits it.
 * - `ios.odr`: pack folders tagged for On-Demand Resources, and `NitroAssetsUsesOnDemandResources`.
 * - `android.playAssetDelivery`: one asset-pack module per pack, `assetPacks` in the app module,
 *   and a manifest entry listing the packs.
 *
 * ["react-native-nitro-assets", {
 *   "packs": { "intent-model": { "path": "./asset-packs/intent-model" } },
 *   "ios": { "backgroundAssets": { "appGroupId": "group.com.example.app", "packs": { "intent-model": "essential" } } },
 *   "android": { "playAssetDelivery": { "packs": { "intent-model": "fast-follow" } } }
 * }]
 */
const withNitroAssets = (config, props) => {
  const resolved = resolveProps(props, { bundleIdentifier: config.ios && config.ios.bundleIdentifier });
  const { backgroundAssets, odr } = resolved.ios;
  const { playAssetDelivery } = resolved.android;

  if (backgroundAssets) {
    // On the config itself (not only the entitlements mod): expo-native-config reads
    // ios.entitlements to give extension targets the host app's groups.
    config.ios = config.ios || {};
    config.ios.entitlements = ios.applyAppGroupEntitlement(config.ios.entitlements || {}, backgroundAssets);
    config = withInfoPlist(config, (mod) => {
      mod.modResults = ios.applyBackgroundAssetsInfoPlist(mod.modResults, backgroundAssets);
      return mod;
    });
    config = withEntitlementsPlist(config, (mod) => {
      mod.modResults = ios.applyAppGroupEntitlement(mod.modResults, backgroundAssets);
      return mod;
    });
  }

  if (odr) {
    config = withInfoPlist(config, (mod) => {
      mod.modResults = ios.applyOnDemandResourcesInfoPlist(mod.modResults);
      return mod;
    });
    config = withDangerousMod(config, [
      'ios',
      async (mod) => {
        ios.copyOnDemandResourcePacks({
          projectRoot: mod.modRequest.projectRoot,
          platformProjectRoot: mod.modRequest.platformProjectRoot,
          packs: resolved.packs,
          odr,
        });
        return mod;
      },
    ]);
    config = withXcodeProject(config, (mod) => {
      mod.modResults = ios.applyOnDemandResourcesProject(mod.modResults, { odr });
      return mod;
    });
  }

  if (playAssetDelivery) {
    config = withSettingsGradle(config, (mod) => {
      mod.modResults.contents = android.applySettingsGradle(
        mod.modResults.contents,
        { playAssetDelivery },
        mod.modResults.language,
      );
      return mod;
    });
    config = withAppBuildGradle(config, (mod) => {
      mod.modResults.contents = android.applyAppBuildGradle(
        mod.modResults.contents,
        { playAssetDelivery },
        mod.modResults.language,
      );
      return mod;
    });
    config = withAndroidManifest(config, (mod) => {
      mod.modResults = android.applyManifest(mod.modResults, { playAssetDelivery });
      return mod;
    });
    config = withDangerousMod(config, [
      'android',
      async (mod) => {
        android.writeAssetPackModules({
          projectRoot: mod.modRequest.projectRoot,
          platformProjectRoot: mod.modRequest.platformProjectRoot,
          packs: resolved.packs,
          playAssetDelivery,
        });
        return mod;
      },
    ]);
  }

  return config;
};

module.exports = createRunOncePlugin(withNitroAssets, pkg.name, pkg.version);
