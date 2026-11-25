import Foundation

extension Bundle {
  /// Whether the app declares Apple-hosted, managed asset packs (`BAHasManagedAssetPacks` and
  /// `BAUsesAppleHosting` set to YES, `BAAppGroupID` present), as the config plugin writes them.
  ///
  /// `AssetPackManager.shared` must not be touched otherwise: its first use opts the app into
  /// system-managed packs, and using it without the downloader extension is a programmer error.
  var usesAppleHostedAssetPacks: Bool {
    let managed = object(forInfoDictionaryKey: "BAHasManagedAssetPacks") as? Bool ?? false
    let appleHosted = object(forInfoDictionaryKey: "BAUsesAppleHosting") as? Bool ?? false
    let appGroup = object(forInfoDictionaryKey: "BAAppGroupID") as? String ?? ""
    return managed && appleHosted && !appGroup.isEmpty
  }

  /// Why Background Assets cannot run in this build, or nil when it can. Checked before
  /// `AssetPackManager.shared` is first touched: without the downloader extension or the app group,
  /// the framework stops the process with an assertion instead of returning an error.
  var backgroundAssetsSetupProblem: String? {
    var missing: [String] = []
    if !hasBackgroundAssetsDownloaderExtension {
      missing.append("no downloader extension (com.apple.background-asset-downloader-extension) is embedded under Extensions/; link react-native-nitro-assets/downloader with expo-native-config")
    }
    let appGroup = object(forInfoDictionaryKey: "BAAppGroupID") as? String ?? ""
    if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) == nil {
      missing.append("the app group \"\(appGroup)\" is not in the app's entitlements (com.apple.security.application-groups), or the provisioning profile does not include it")
    }
    return missing.isEmpty ? nil : "Background Assets is configured but cannot run: " + missing.joined(separator: "; ")
  }

  /// Whether an ExtensionKit extension for the Background Assets downloader point ships in the app.
  var hasBackgroundAssetsDownloaderExtension: Bool {
    let folder = bundleURL.appendingPathComponent("Extensions", isDirectory: true)
    let items = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
    return items.contains { url in
      guard url.pathExtension == "appex",
        let attributes = Bundle(url: url)?.object(forInfoDictionaryKey: "EXAppExtensionAttributes") as? [String: Any]
      else {
        return false
      }
      return attributes["EXExtensionPointIdentifier"] as? String == "com.apple.background-asset-downloader-extension"
    }
  }

  /// Whether the config plugin enabled the On-Demand Resources fallback
  /// (`NitroAssetsUsesOnDemandResources` = YES).
  var usesOnDemandResourcesFallback: Bool {
    return object(forInfoDictionaryKey: "NitroAssetsUsesOnDemandResources") as? Bool ?? false
  }
}
