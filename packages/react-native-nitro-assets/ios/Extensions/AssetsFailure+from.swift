import Foundation

extension AssetsFailure {
  /// Maps any error a backend threw to a coded failure. Backend-specific mappings run first; this
  /// handles what every backend shares (cancellation, networking, disk space).
  static func from(_ error: Error, packId: String) -> AssetsFailure {
    if let failure = error as? AssetsFailure {
      return failure
    }
    if error is CancellationError {
      return AssetsFailure(.cancelled, "Cancelled while working on asset pack \"\(packId)\"")
    }
    let nsError = error as NSError
    if nsError.domain == NSURLErrorDomain {
      return AssetsFailure(.network, "Network error for asset pack \"\(packId)\": \(nsError.localizedDescription)")
    }
    if nsError.domain == NSCocoaErrorDomain && nsError.code == NSFileWriteOutOfSpaceError {
      return AssetsFailure(.insufficientStorage, "Not enough space for asset pack \"\(packId)\"")
    }
    return AssetsFailure(.unknown, "Asset pack \"\(packId)\": \(nsError.localizedDescription) (\(nsError.domain) \(nsError.code))")
  }
}
