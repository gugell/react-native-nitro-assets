import Foundation

extension NSBundleResourceRequest {
  /// `beginAccessingResources` as an async call.
  func beginAccessing() async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      beginAccessingResources { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }

  /// `conditionallyBeginAccessingResources` as an async call: true when the resources are already
  /// on the device (and are now being accessed), false otherwise.
  func conditionallyBeginAccessing() async -> Bool {
    await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
      conditionallyBeginAccessingResources { available in
        continuation.resume(returning: available)
      }
    }
  }
}
