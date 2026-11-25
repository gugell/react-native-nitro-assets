package com.margelo.nitro.assets

import com.google.android.play.core.assetpacks.model.AssetPackStatus as PlayStatus
import com.google.android.play.core.assetpacks.AssetPackState as PlayAssetPackState

/**
 * Overall progress from 0 to 1: the download is the first 95 %, unpacking into app storage
 * (TRANSFERRING) the rest. Null for states without progress.
 */
internal fun PlayAssetPackState.downloadFraction(): Double? {
  return when (status()) {
    PlayStatus.DOWNLOADING -> {
      val total = totalBytesToDownload()
      if (total > 0) 0.95 * bytesDownloaded().toDouble() / total.toDouble() else null
    }
    PlayStatus.TRANSFERRING -> 0.95 + 0.05 * transferProgressPercentage().toDouble() / 100.0
    PlayStatus.COMPLETED -> 1.0
    else -> null
  }
}
