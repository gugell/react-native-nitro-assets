import Foundation

/// The codes of `AssetsErrorCode` in the TypeScript layer.
enum AssetsFailureCode: String {
  case unsupportedPlatform = "unsupported_platform"
  case unsupportedOS = "unsupported_os"
  case misconfigured
  case packNotFound = "pack_not_found"
  case packNotDownloaded = "pack_not_downloaded"
  case fileNotFound = "file_not_found"
  case storeUnavailable = "store_unavailable"
  case userConfirmationRequired = "user_confirmation_required"
  case network
  case insufficientStorage = "insufficient_storage"
  case notAllowed = "not_allowed"
  case invalidArgument = "invalid_argument"
  case timeout
  case cancelled
  case unknown
}
