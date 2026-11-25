package com.margelo.nitro.assets

/**
 * A pack the config plugin added to the app bundle. Play pack names allow only letters, digits
 * and `_`, so `intent-model` is the Play pack `intent_model`.
 */
internal data class DeclaredPack(val packId: String, val delivery: PackDelivery) {
  val playName: String get() = packId.replace('-', '_')
}
