import Foundation

/// One system that delivers asset packs. `HybridAssetPacks` picks one per process and forwards
/// every call; implementations throw `AssetsFailure`.
///
/// Files of a pack live under `<packId>/` in the backend's namespace, which is how the
/// `nitro-assets` CLI and the config plugin lay packs out.
protocol AssetPackBackend: Sendable {
  var kind: AssetBackend { get }
  func status(of packId: String) async throws -> AssetPackStatus
  func ensureAvailable(_ packId: String, requireLatestVersion: Bool, onProgress: (@Sendable (Double) -> Void)?) async throws
  func fileUrl(packId: String, relativePath: String) async throws -> String
  func remove(_ packId: String) async throws
}
