package com.margelo.nitro.assets

/** How Play delivers a pack, as the config plugin declared it. */
internal enum class PackDelivery(val value: String) {
  INSTALL_TIME("install-time"),
  FAST_FOLLOW("fast-follow"),
  ON_DEMAND("on-demand");

  companion object {
    fun fromValue(value: String): PackDelivery? = entries.firstOrNull { it.value == value }
  }
}
