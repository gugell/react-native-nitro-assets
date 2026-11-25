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

  /// Whether the config plugin enabled the On-Demand Resources fallback
  /// (`NitroAssetsUsesOnDemandResources` = YES).
  var usesOnDemandResourcesFallback: Bool {
    return object(forInfoDictionaryKey: "NitroAssetsUsesOnDemandResources") as? Bool ?? false
  }
}
