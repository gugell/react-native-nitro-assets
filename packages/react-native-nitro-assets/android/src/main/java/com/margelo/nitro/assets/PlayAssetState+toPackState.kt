package com.margelo.nitro.assets

import com.google.android.play.core.assetpacks.model.AssetPackStatus as PlayStatus
import com.google.android.play.core.assetpacks.AssetPackState as PlayAssetPackState

/** The cross-platform state of a Play pack state. */
internal fun PlayAssetPackState.toPackState(): AssetPackState {
  return when (status()) {
    PlayStatus.COMPLETED -> AssetPackState.AVAILABLE
    PlayStatus.PENDING,
    PlayStatus.DOWNLOADING,
    PlayStatus.TRANSFERRING,
    PlayStatus.WAITING_FOR_WIFI -> AssetPackState.DOWNLOADING
    else -> AssetPackState.NOT_DOWNLOADED
  }
}
