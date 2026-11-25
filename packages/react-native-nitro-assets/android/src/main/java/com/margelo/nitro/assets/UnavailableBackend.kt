package com.margelo.nitro.assets

/** Used when no backend can serve this app: every call throws [reason]. */
internal class UnavailableBackend(private val reason: AssetsFailure) : AssetPackBackend {
  override val kind: AssetBackend = AssetBackend.NONE

  override suspend fun status(packId: String): AssetPackStatus = throw reason

  override suspend fun ensureAvailable(packId: String, onProgress: ((Double) -> Unit)?) = throw reason

  override suspend fun fileUrl(packId: String, relativePath: String): String = throw reason

  override suspend fun remove(packId: String) = throw reason
}
