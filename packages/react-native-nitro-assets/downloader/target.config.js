/**
 * The Apple-hosted Background Assets downloader extension (iOS 26+), as an expo-native-config
 * target. Link it from the app's workspace.config.ts:
 *
 *   ios: { targets: [{ package: 'react-native-nitro-assets/downloader', bundleIdentifier: '.AssetDownloader' }] }
 *
 * The extension inherits the app group that the react-native-nitro-assets config plugin sets
 * (ios.backgroundAssets.appGroupId). The system runs it to download essential and prefetch packs
 * during install and updates; the app itself downloads on-demand packs through AssetPackManager.
 */
module.exports = {
  name: 'NitroAssetsDownloader',
  type: 'background-download',
  deploymentTarget: '26.0',
  frameworks: ['BackgroundAssets', 'StoreKit'],
};
