package com.margelo.nitro.assets

import android.content.Context
import android.net.Uri
import com.google.android.play.core.assetpacks.AssetPackException
import com.google.android.play.core.assetpacks.AssetPackManager
import com.google.android.play.core.assetpacks.AssetPackManagerFactory
import com.google.android.play.core.assetpacks.AssetPackStateUpdateListener
import com.google.android.play.core.assetpacks.model.AssetPackStatus as PlayStatus
import com.google.android.play.core.assetpacks.model.AssetPackStorageMethod
import com.google.android.play.core.assetpacks.AssetPackState as PlayAssetPackState
import com.google.android.play.core.ktx.requestFetch
import com.google.android.play.core.ktx.requestPackStates
import com.google.android.play.core.ktx.requestRemovePack
import java.io.File
import kotlinx.coroutines.CompletableDeferred

/**
 * Google Play Asset Delivery. Packs are the ones the config plugin declared in the manifest; their
 * files sit under `<packId>/` in the pack's assets. Fast-follow and on-demand packs are read from
 * the directory Play unpacks them into; install-time packs are copied out of the APK on first use.
 */
internal class PlayAssetDeliveryBackend(
  private val context: Context,
  private val packs: Map<String, DeclaredPack>,
) : AssetPackBackend {
  override val kind: AssetBackend = AssetBackend.PLAY_ASSET_DELIVERY

  private val manager: AssetPackManager by lazy { AssetPackManagerFactory.getInstance(context) }
  private val extractor = InstallTimeAssetExtractor(context)

  override suspend fun status(packId: String): AssetPackStatus {
    val pack = declared(packId)
    if (pack.delivery == PackDelivery.INSTALL_TIME || assetsDirectory(pack) != null) {
      return AssetPackStatus(packId, AssetPackState.AVAILABLE, false, null)
    }
    val state = packState(pack)
    val size = state.totalBytesToDownload().takeIf { it > 0 }?.toDouble()
    return AssetPackStatus(packId, state.toPackState(), false, size)
  }

  override suspend fun ensureAvailable(packId: String, onProgress: ((Double) -> Unit)?) {
    val pack = declared(packId)
    if (pack.delivery == PackDelivery.INSTALL_TIME || assetsDirectory(pack) != null) {
      return
    }
    val done = CompletableDeferred<Unit>()
    val listener = AssetPackStateUpdateListener { state ->
      if (state.name() == pack.playName) {
        handle(state, pack, done, onProgress)
      }
    }
    manager.registerListener(listener)
    try {
      val states = try {
        manager.requestFetch(listOf(pack.playName))
      } catch (error: AssetPackException) {
        throw error.toAssetsFailure(packId)
      }
      states.packStates()[pack.playName]?.let { handle(it, pack, done, onProgress) }
      done.await()
    } finally {
      manager.unregisterListener(listener)
    }
  }

  override suspend fun fileUrl(packId: String, relativePath: String): String {
    val pack = declared(packId)
    val file = if (pack.delivery == PackDelivery.INSTALL_TIME) {
      extractor.extract(packId, relativePath)
    } else {
      val directory = assetsDirectory(pack)
        ?: throw AssetsFailure(AssetsFailureCode.PACK_NOT_DOWNLOADED, "Asset pack \"$packId\" is not on the device; call ensureAvailable first")
      File(File(directory, packId), relativePath).also {
        if (!it.isFile) {
          throw AssetsFailure(AssetsFailureCode.FILE_NOT_FOUND, "Asset pack \"$packId\" has no file \"$relativePath\"")
        }
      }
    }
    return Uri.fromFile(file).toString()
  }

  override suspend fun remove(packId: String) {
    val pack = declared(packId)
    if (pack.delivery == PackDelivery.INSTALL_TIME) {
      extractor.clear(packId)
      return
    }
    if (assetsDirectory(pack) == null) {
      return
    }
    try {
      manager.requestRemovePack(pack.playName)
    } catch (error: AssetPackException) {
      throw error.toAssetsFailure(packId)
    }
  }

  private fun declared(packId: String): DeclaredPack {
    return packs[packId]
      ?: throw AssetsFailure(AssetsFailureCode.PACK_NOT_FOUND, "Asset pack \"$packId\" is not in android.playAssetDelivery.packs of the config plugin")
  }

  /** The directory Play unpacked a fast-follow or on-demand pack into, or null when it is not local. */
  private fun assetsDirectory(pack: DeclaredPack): File? {
    val location = manager.getPackLocation(pack.playName) ?: return null
    if (location.packStorageMethod() != AssetPackStorageMethod.STORAGE_FILES) {
      return null
    }
    return location.assetsPath()?.let(::File)
  }

  private suspend fun packState(pack: DeclaredPack): PlayAssetPackState {
    val states = try {
      manager.requestPackStates(listOf(pack.playName))
    } catch (error: AssetPackException) {
      throw error.toAssetsFailure(pack.packId)
    }
    return states.packStates()[pack.playName]
      ?: throw AssetsFailure(AssetsFailureCode.PACK_NOT_FOUND, "Play reported no state for asset pack \"${pack.packId}\"")
  }

  /** Settles [done] on a final state; reports progress otherwise. Play calls listeners on the main thread. */
  private fun handle(
    state: PlayAssetPackState,
    pack: DeclaredPack,
    done: CompletableDeferred<Unit>,
    onProgress: ((Double) -> Unit)?,
  ) {
    when (state.status()) {
      PlayStatus.COMPLETED -> {
        onProgress?.invoke(1.0)
        done.complete(Unit)
      }
      PlayStatus.FAILED ->
        done.completeExceptionally(AssetsFailure.fromPlayErrorCode(state.errorCode(), pack.packId))
      PlayStatus.CANCELED ->
        done.completeExceptionally(AssetsFailure(AssetsFailureCode.CANCELLED, "The download of asset pack \"${pack.packId}\" was cancelled"))
      PlayStatus.WAITING_FOR_WIFI, PlayStatus.REQUIRES_USER_CONFIRMATION ->
        done.completeExceptionally(
          AssetsFailure(
            AssetsFailureCode.USER_CONFIRMATION_REQUIRED,
            "Play waits for the user to confirm the download of asset pack \"${pack.packId}\" (Wi-Fi only, or the app was not installed from Play)",
          ),
        )
      else -> state.downloadFraction()?.let { onProgress?.invoke(it) }
    }
  }
}
