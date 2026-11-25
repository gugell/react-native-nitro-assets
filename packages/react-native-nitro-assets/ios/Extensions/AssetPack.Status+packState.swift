import BackgroundAssets

@available(iOS 26.0, *)
extension AssetPack.Status {
  /// The cross-platform state: a pack with any local version is `available` (even while an update
  /// downloads), otherwise `downloading` or `notDownloaded`.
  var packState: AssetPackState {
    if contains(.downloaded) || contains(.upToDate) || contains(.outOfDate) {
      return .available
    }
    if contains(.downloading) {
      return .downloading
    }
    return .notDownloaded
  }
}
