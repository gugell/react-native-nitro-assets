import Foundation

/// The fallback below iOS 26: On-Demand Resources (`NSBundleResourceRequest`). The config plugin
/// tags a folder reference named `<packId>` with the tag `<packId>`, so a pack's files sit at
/// `<packId>/<relativePath>` in the bundle once its request is accessing.
///
/// The system may purge resources nobody is accessing, so this backend keeps one accessing request
/// per pack for the life of the process, until `remove` ends it.
actor OnDemandResourcesBackend: AssetPackBackend {
  nonisolated var kind: AssetBackend { .onDemandResources }

  private var accessing: [String: NSBundleResourceRequest] = [:]
  private var downloading: Set<String> = []

  func status(of packId: String) async throws -> AssetPackStatus {
    if downloading.contains(packId) {
      return AssetPackStatus(packId: packId, state: .downloading, isUpdateAvailable: false, downloadSizeBytes: nil)
    }
    let isLocal = try await accessIfLocal(packId) != nil
    return AssetPackStatus(packId: packId, state: isLocal ? .available : .notDownloaded, isUpdateAvailable: false, downloadSizeBytes: nil)
  }

  func ensureAvailable(_ packId: String, requireLatestVersion: Bool, onProgress: (@Sendable (Double) -> Void)?) async throws {
    if try await accessIfLocal(packId) != nil {
      return
    }
    let request = NSBundleResourceRequest(tags: [packId])
    request.loadingPriority = NSBundleResourceRequestLoadingPriorityUrgent
    let observation = onProgress.map { report in
      request.progress.observe(\.fractionCompleted) { progress, _ in report(progress.fractionCompleted) }
    }
    downloading.insert(packId)
    defer {
      observation?.invalidate()
      downloading.remove(packId)
    }
    do {
      try await request.beginAccessing()
    } catch {
      throw AssetsFailure.fromOnDemandResources(error, packId: packId)
    }
    accessing[packId] = request
    onProgress?(1)
  }

  func fileUrl(packId: String, relativePath: String) async throws -> String {
    guard let request = try await accessIfLocal(packId) else {
      throw AssetsFailure(.packNotDownloaded, "Asset pack \"\(packId)\" is not on the device; call ensureAvailable first")
    }
    guard let folder = request.bundle.url(forResource: packId, withExtension: nil) else {
      throw AssetsFailure(.misconfigured, "The app bundle has no folder \"\(packId)\": add the pack to ios.odr in the config plugin and rebuild")
    }
    let url = folder.appendingPathComponent(relativePath)
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw AssetsFailure(.fileNotFound, "Asset pack \"\(packId)\" has no file \"\(relativePath)\"")
    }
    return url.absoluteString
  }

  /// On-Demand Resources cannot be deleted on request: this stops accessing the pack and lets the
  /// system purge it first when it needs space.
  func remove(_ packId: String) async throws {
    accessing.removeValue(forKey: packId)?.endAccessingResources()
    Bundle.main.setPreservationPriority(0, forTags: [packId])
  }

  /// The accessing request of a pack that is already on the device, or nil when it is not.
  private func accessIfLocal(_ packId: String) async throws -> NSBundleResourceRequest? {
    if let request = accessing[packId] {
      return request
    }
    let request = NSBundleResourceRequest(tags: [packId])
    guard await request.conditionallyBeginAccessing() else {
      return nil
    }
    accessing[packId] = request
    return request
  }
}
