import Foundation

/// A coded failure. Nitro turns a thrown Swift error into a JavaScript `Error` whose message is
/// `description`, so the code travels in a fixed prefix the TypeScript layer parses:
/// `[nitro-assets:<code>] message`.
struct AssetsFailure: Error, CustomStringConvertible {
  let code: AssetsFailureCode
  let message: String

  init(_ code: AssetsFailureCode, _ message: String) {
    self.code = code
    self.message = message
  }

  var description: String {
    return "[nitro-assets:\(code.rawValue)] \(message)"
  }
}
