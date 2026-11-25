package com.margelo.nitro.assets

/** The codes of `AssetsErrorCode` in the TypeScript layer. */
internal enum class AssetsFailureCode(val value: String) {
  UNSUPPORTED_PLATFORM("unsupported_platform"),
  UNSUPPORTED_OS("unsupported_os"),
  MISCONFIGURED("misconfigured"),
  PACK_NOT_FOUND("pack_not_found"),
  PACK_NOT_DOWNLOADED("pack_not_downloaded"),
  FILE_NOT_FOUND("file_not_found"),
  STORE_UNAVAILABLE("store_unavailable"),
  USER_CONFIRMATION_REQUIRED("user_confirmation_required"),
  NETWORK("network"),
  INSUFFICIENT_STORAGE("insufficient_storage"),
  NOT_ALLOWED("not_allowed"),
  INVALID_ARGUMENT("invalid_argument"),
  TIMEOUT("timeout"),
  CANCELLED("cancelled"),
  UNKNOWN("unknown"),
}
