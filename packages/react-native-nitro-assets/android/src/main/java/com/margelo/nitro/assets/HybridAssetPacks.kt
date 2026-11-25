package com.margelo.nitro.assets

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

/**
 * The `AssetPacks` hybrid object: Play Asset Delivery when the config plugin declared packs
 * (`android.playAssetDelivery`), otherwise every call rejects with `misconfigured`.
 */
@Keep
@DoNotStrip
class HybridAssetPacks : HybridAssetPacksSpec() {
  @Volatile private var resolved: AssetPackBackend? = null

  /** Resolved once React Native's context exists; until then each call reports it missing. */
  private val implementation: AssetPackBackend
    get() = resolved ?: createBackend()

  override val backend: AssetBackend
    get() = implementation.kind

  override fun getStatus(packId: String): Promise<AssetPackStatus> =
    Promise.async { implementation.status(packId) }

  override fun ensureAvailable(packId: String, requireLatestVersion: Boolean, onProgress: ((fraction: Double) -> Unit)?): Promise<Unit> =
    Promise.async { implementation.ensureAvailable(packId, onProgress) }

  override fun getFileUrl(packId: String, relativePath: String): Promise<String> =
    Promise.async { implementation.fileUrl(packId, relativePath) }

  override fun remove(packId: String): Promise<Unit> =
    Promise.async { implementation.remove(packId) }

  private fun createBackend(): AssetPackBackend {
    val context = NitroModules.applicationContext
      ?: return UnavailableBackend(AssetsFailure(AssetsFailureCode.MISCONFIGURED, "React Native's application context is not available yet"))
    val packs = context.declaredAssetPacks()
      ?: return UnavailableBackend(
        AssetsFailure(
          AssetsFailureCode.MISCONFIGURED,
          "No asset packs are configured: add android.playAssetDelivery to the react-native-nitro-assets config plugin, then rebuild",
        ),
      ).also { resolved = it }
    return PlayAssetDeliveryBackend(context, packs).also { resolved = it }
  }
}
