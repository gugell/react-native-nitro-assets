import Foundation

/// A JavaScript progress callback that native code may call from any thread: Nitro callbacks
/// dispatch to the JS thread themselves.
struct ProgressCallback: @unchecked Sendable {
  private let callback: (Double) -> Void

  init(_ callback: @escaping (Double) -> Void) {
    self.callback = callback
  }

  @Sendable func callAsFunction(_ fraction: Double) {
    callback(fraction)
  }
}
