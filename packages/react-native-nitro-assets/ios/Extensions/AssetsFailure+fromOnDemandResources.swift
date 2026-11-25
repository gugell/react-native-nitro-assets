import Foundation

extension AssetsFailure {
  /// Maps On-Demand Resources errors to coded failures.
  static func fromOnDemandResources(_ error: Error, packId: String) -> AssetsFailure {
    let nsError = error as NSError
    guard nsError.domain == NSCocoaErrorDomain else {
      return AssetsFailure.from(error, packId: packId)
    }
    switch nsError.code {
    case NSBundleOnDemandResourceInvalidTagError:
      return AssetsFailure(.packNotFound, "The app has no On-Demand Resources tag \"\(packId)\": add the pack to ios.odr in the config plugin and rebuild")
    case NSBundleOnDemandResourceOutOfSpaceError:
      return AssetsFailure(.insufficientStorage, "Not enough space to download asset pack \"\(packId)\"")
    case NSBundleOnDemandResourceExceededMaximumSizeError:
      return AssetsFailure(.misconfigured, "Asset pack \"\(packId)\" exceeds the On-Demand Resources size limit in use at one time")
    case NSUserCancelledError:
      return AssetsFailure(.cancelled, "The download of asset pack \"\(packId)\" was cancelled")
    default:
      return AssetsFailure.from(error, packId: packId)
    }
  }
}
