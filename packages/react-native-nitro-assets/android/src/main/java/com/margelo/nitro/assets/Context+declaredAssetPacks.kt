package com.margelo.nitro.assets

import android.content.Context
import android.content.pm.PackageManager

/** Manifest meta-data the config plugin writes: `packId=deliveryType;…`. */
internal const val PACKS_META_DATA = "com.margelo.nitro.assets.packs"

/**
 * The packs the config plugin declared, by pack id, or null when the app has no
 * `android.playAssetDelivery` configuration.
 */
internal fun Context.declaredAssetPacks(): Map<String, DeclaredPack>? {
  val info = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
  val value = info.metaData?.getString(PACKS_META_DATA) ?: return null
  return value.split(';')
    .mapNotNull { entry ->
      val parts = entry.split('=')
      val packId = parts.getOrNull(0)?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
      val delivery = parts.getOrNull(1)?.let { PackDelivery.fromValue(it) } ?: return@mapNotNull null
      DeclaredPack(packId, delivery)
    }
    .associateBy { it.packId }
}
