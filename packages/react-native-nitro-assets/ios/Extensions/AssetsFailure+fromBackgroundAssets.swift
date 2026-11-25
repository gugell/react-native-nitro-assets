import BackgroundAssets
import Foundation

@available(iOS 26.0, *)
extension AssetsFailure {
  /// Maps Background Assets errors to coded failures.
  static func fromBackgroundAssets(_ error: Error, packId: String) -> AssetsFailure {
    if let failure = error as? AssetsFailure {
      return failure
    }
    if let managed = error as? ManagedBackgroundAssetsError {
      switch managed {
      case .assetPackNotFound:
        return AssetsFailure(
          .packNotFound,
          "The App Store has no asset pack \"\(packId)\" for this install. Upload it to App Store Connect and release it to this channel; Apple-hosted packs only download in TestFlight and App Store installs (or from a ba-serve mock server in development)."
        )
      case .fileNotFound(let path):
        return AssetsFailure(.fileNotFound, "Asset pack \"\(packId)\" has no file \"\(path)\"")
      @unknown default:
        return AssetsFailure(.unknown, "Asset pack \"\(packId)\": \(managed.localizedDescription)")
      }
    }
    let nsError = error as NSError
    if nsError.domain == BAErrorDomain, let code = BAErrorCode(rawValue: nsError.code) {
      switch code {
      case .downloadBackgroundActivityProhibited,
        .callFromInactiveProcessNotAllowed,
        .downloadWouldExceedAllowance,
        .downloadEssentialDownloadNotPermitted,
        .sessionDownloadAllowanceExceeded,
        .sessionDownloadDisallowedByAllowance,
        .sessionDownloadNotPermittedBeforeAppLaunch:
        return AssetsFailure(.notAllowed, "The system refused to download asset pack \"\(packId)\" now: \(nsError.localizedDescription)")
      case .callerConnectionNotAccepted, .callerConnectionInvalid, .sessionDownloadDisallowedByDomain:
        return AssetsFailure(.misconfigured, "Background Assets rejected the app (check BAAppGroupID, the app group entitlement and the downloader extension): \(nsError.localizedDescription)")
      default:
        break
      }
    }
    return AssetsFailure.from(error, packId: packId)
  }
}
