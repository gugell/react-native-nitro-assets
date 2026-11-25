import BackgroundAssets
import Foundation
import System

/// Apple-hosted Background Assets through `AssetPackManager` (iOS 26+). Requires the Info.plist
/// keys and the downloader extension the config plugin adds; `HybridAssetPacks` only creates this
/// backend when `Bundle.usesAppleHostedAssetPacks` is true.
@available(iOS 26.0, *)
final class BackgroundAssetsBackend: AssetPackBackend {
  var kind: AssetBackend { .backgroundAssets }

  private var manager: AssetPackManager { AssetPackManager.shared }

  func status(of packId: String) async throws -> AssetPackStatus {
    do {
      let pack = try await manager.assetPack(withID: packId)
      let status = try await remoteStatus(of: pack)
      return AssetPackStatus(
        packId: packId,
        state: status.packState,
        isUpdateAvailable: status.contains(.updateAvailable),
        downloadSizeBytes: Double(pack.downloadSize)
      )
    } catch {
      let failure = AssetsFailure.fromBackgroundAssets(error, packId: packId)
      // Offline: report what is on the device instead of failing.
      if failure.code == .network, #available(iOS 26.4, *) {
        let local = await manager.localStatus(ofAssetPackWithID: packId)
        return AssetPackStatus(packId: packId, state: local.packState, isUpdateAvailable: false, downloadSizeBytes: nil)
      }
      throw failure
    }
  }

  func ensureAvailable(_ packId: String, requireLatestVersion: Bool, onProgress: (@Sendable (Double) -> Void)?) async throws {
    do {
      if !requireLatestVersion, isAvailableLocally(packId) {
        return
      }
      let pack = try await manager.assetPack(withID: packId)
      let progressTask = onProgress.map { report in
        Task { await self.forwardProgress(of: packId, to: report) }
      }
      defer { progressTask?.cancel() }
      if #available(iOS 26.4, *) {
        try await manager.ensureLocalAvailability(of: pack, requireLatestVersion: requireLatestVersion)
      } else {
        try await manager.ensureLocalAvailability(of: pack)
      }
    } catch {
      throw AssetsFailure.fromBackgroundAssets(error, packId: packId)
    }
  }

  func fileUrl(packId: String, relativePath: String) async throws -> String {
    guard await isLocal(packId) else {
      throw AssetsFailure(.packNotDownloaded, "Asset pack \"\(packId)\" is not on the device; call ensureAvailable first")
    }
    do {
      // All packs share one namespace; the nitro-assets CLI packages each pack under "<packId>/".
      let url = try manager.url(for: FilePath("\(packId)/\(relativePath)"))
      guard FileManager.default.fileExists(atPath: url.path) else {
        throw AssetsFailure(.fileNotFound, "Asset pack \"\(packId)\" has no file \"\(relativePath)\"")
      }
      return url.absoluteString
    } catch {
      throw AssetsFailure.fromBackgroundAssets(error, packId: packId)
    }
  }

  func remove(_ packId: String) async throws {
    if #available(iOS 26.4, *), !manager.assetPackIsAvailableLocally(withID: packId) {
      return
    }
    do {
      try await manager.remove(assetPackWithID: packId)
    } catch {
      throw AssetsFailure.fromBackgroundAssets(error, packId: packId)
    }
  }

  private func remoteStatus(of pack: AssetPack) async throws -> AssetPack.Status {
    if #available(iOS 26.4, *) {
      return try await manager.status(relativeTo: pack)
    }
    return try await manager.status(ofAssetPackWithID: pack.id)
  }

  /// A local check that needs no network; only iOS 26.4+ has one.
  private func isAvailableLocally(_ packId: String) -> Bool {
    if #available(iOS 26.4, *) {
      return manager.assetPackIsAvailableLocally(withID: packId)
    }
    return false
  }

  /// Whether the pack is local. On iOS 26.0–26.3 the status query may need the network; when it
  /// fails, the file check that follows decides.
  private func isLocal(_ packId: String) async -> Bool {
    if #available(iOS 26.4, *) {
      return manager.assetPackIsAvailableLocally(withID: packId)
    }
    guard let status = try? await manager.status(ofAssetPackWithID: packId) else {
      return true
    }
    return status.packState == .available
  }

  private func forwardProgress(of packId: String, to report: @Sendable (Double) -> Void) async {
    for await update in manager.statusUpdates(forAssetPackWithID: packId) {
      switch update {
      case .downloading(_, let progress):
        report(progress.fractionCompleted)
      case .finished:
        report(1)
        return
      case .failed:
        return
      case .began, .paused:
        continue
      @unknown default:
        continue
      }
    }
  }
}
