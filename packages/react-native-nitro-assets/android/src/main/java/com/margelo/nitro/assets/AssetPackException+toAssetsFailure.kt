package com.margelo.nitro.assets

import com.google.android.play.core.assetpacks.AssetPackException
import com.google.android.play.core.assetpacks.model.AssetPackErrorCode

/** Maps a Play Asset Delivery error code to a coded failure. */
internal fun AssetsFailure.Companion.fromPlayErrorCode(errorCode: Int, packId: String, cause: Throwable? = null): AssetsFailure {
  return when (errorCode) {
    AssetPackErrorCode.PACK_UNAVAILABLE ->
      AssetsFailure(AssetsFailureCode.PACK_NOT_FOUND, "Play has no asset pack \"$packId\" for this app version", cause)
    AssetPackErrorCode.APP_UNAVAILABLE,
    AssetPackErrorCode.APP_NOT_OWNED,
    AssetPackErrorCode.UNRECOGNIZED_INSTALLATION,
    AssetPackErrorCode.API_NOT_AVAILABLE ->
      AssetsFailure(
        AssetsFailureCode.STORE_UNAVAILABLE,
        "Play cannot serve asset pack \"$packId\" to this install (error $errorCode): install the app from Play (internal testing or internal app sharing), or test with bundletool --local-testing",
        cause,
      )
    AssetPackErrorCode.NETWORK_ERROR ->
      AssetsFailure(AssetsFailureCode.NETWORK, "Network error while downloading asset pack \"$packId\"", cause)
    AssetPackErrorCode.ACCESS_DENIED ->
      AssetsFailure(AssetsFailureCode.NOT_ALLOWED, "Play refused to download asset pack \"$packId\" now (is the app in the foreground?)", cause)
    AssetPackErrorCode.INSUFFICIENT_STORAGE ->
      AssetsFailure(AssetsFailureCode.INSUFFICIENT_STORAGE, "Not enough space for asset pack \"$packId\"", cause)
    else ->
      AssetsFailure(AssetsFailureCode.UNKNOWN, "Play Asset Delivery error $errorCode for asset pack \"$packId\"", cause)
  }
}

/** Maps a failed Play Asset Delivery task to a coded failure. */
internal fun AssetPackException.toAssetsFailure(packId: String): AssetsFailure =
  AssetsFailure.fromPlayErrorCode(errorCode, packId, this)
