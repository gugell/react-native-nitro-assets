package com.margelo.nitro.assets

/**
 * One system that delivers asset packs; `HybridAssetPacks` picks one and forwards every call.
 * Implementations throw [AssetsFailure].
 */
internal interface AssetPackBackend {
  val kind: AssetBackend
  suspend fun status(packId: String): AssetPackStatus
  suspend fun ensureAvailable(packId: String, onProgress: ((Double) -> Unit)?)
  suspend fun fileUrl(packId: String, relativePath: String): String
  suspend fun remove(packId: String)
}
