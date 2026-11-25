import Foundation
import NitroModules

/// The `AssetPacks` hybrid object: picks the backend once (Background Assets on iOS 26+ when the
/// app declares Apple-hosted packs, On-Demand Resources when the fallback is enabled) and forwards
/// every call to it. Each call crosses into Swift concurrency once, through `Promise.async`.
final class HybridAssetPacks: HybridAssetPacksSpec {
  private lazy var implementation: any AssetPackBackend = Self.makeBackend()

  var backend: AssetBackend {
    return implementation.kind
  }

  func getStatus(packId: String) throws -> Promise<AssetPackStatus> {
    let backend = implementation
    return Promise.async {
      try await backend.status(of: packId)
    }
  }

  func ensureAvailable(packId: String, requireLatestVersion: Bool, onProgress: ((_ fraction: Double) -> Void)?) throws -> Promise<Void> {
    let backend = implementation
    let report = onProgress.map(ProgressCallback.init)
    return Promise.async {
      try await backend.ensureAvailable(packId, requireLatestVersion: requireLatestVersion, onProgress: report?.callAsFunction)
    }
  }

  func getFileUrl(packId: String, relativePath: String) throws -> Promise<String> {
    let backend = implementation
    return Promise.async {
      try await backend.fileUrl(packId: packId, relativePath: relativePath)
    }
  }

  func remove(packId: String) throws -> Promise<Void> {
    let backend = implementation
    return Promise.async {
      try await backend.remove(packId)
    }
  }

  private static func makeBackend() -> any AssetPackBackend {
    let bundle = Bundle.main
    if #available(iOS 26.0, *), bundle.usesAppleHostedAssetPacks {
      return BackgroundAssetsBackend()
    }
    if bundle.usesOnDemandResourcesFallback {
      return OnDemandResourcesBackend()
    }
    if bundle.usesAppleHostedAssetPacks {
      return UnavailableBackend(reason: AssetsFailure(.unsupportedOS, "Background Assets needs iOS 26; enable the On-Demand Resources fallback (ios.odr in the config plugin) for older systems"))
    }
    return UnavailableBackend(reason: AssetsFailure(.misconfigured, "No asset-pack backend is configured: add the react-native-nitro-assets config plugin with ios.backgroundAssets or ios.odr, then rebuild"))
  }
}
