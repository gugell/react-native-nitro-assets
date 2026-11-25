import Foundation

/// Used when no backend can serve this device: every call throws the same reason.
struct UnavailableBackend: AssetPackBackend {
  let reason: AssetsFailure

  var kind: AssetBackend { .none }

  func status(of packId: String) async throws -> AssetPackStatus {
    throw reason
  }

  func ensureAvailable(_ packId: String, requireLatestVersion: Bool, onProgress: (@Sendable (Double) -> Void)?) async throws {
    throw reason
  }

  func fileUrl(packId: String, relativePath: String) async throws -> String {
    throw reason
  }

  func remove(_ packId: String) async throws {
    throw reason
  }
}
