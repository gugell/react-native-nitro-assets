package com.margelo.nitro.assets

import android.content.Context
import android.content.pm.PackageManager
import java.io.File
import java.io.FileNotFoundException

/**
 * Install-time packs are part of the APK and have no file path, so files are copied out of the
 * AssetManager on first use, into no-backup app storage. Copies are dropped when the app updates.
 */
internal class InstallTimeAssetExtractor(private val context: Context) {
  private val root: File get() = File(context.noBackupFilesDir, "nitro-assets")

  /** The extracted file for `<packId>/<relativePath>`, copying it out of the APK if needed. */
  fun extract(packId: String, relativePath: String): File {
    val packDir = File(root, packId)
    val marker = File(packDir, ".app-version")
    val version = appVersion()
    if (!marker.isFile || marker.readText() != version) {
      packDir.deleteRecursively()
      packDir.mkdirs()
      marker.writeText(version)
    }
    val target = File(packDir, relativePath)
    if (target.isFile) {
      return target
    }
    try {
      context.assets.open("$packId/$relativePath").use { input ->
        target.parentFile?.mkdirs()
        val partial = File(target.path + ".partial")
        partial.outputStream().use { output -> input.copyTo(output) }
        if (!partial.renameTo(target)) {
          partial.delete()
          throw AssetsFailure(AssetsFailureCode.UNKNOWN, "Could not write \"${target.path}\"")
        }
      }
    } catch (error: FileNotFoundException) {
      throw AssetsFailure(AssetsFailureCode.FILE_NOT_FOUND, "Asset pack \"$packId\" has no file \"$relativePath\"", error)
    }
    return target
  }

  /** Deletes the extracted copies of a pack. */
  fun clear(packId: String) {
    File(root, packId).deleteRecursively()
  }

  private fun appVersion(): String {
    val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_META_DATA)
    return info.lastUpdateTime.toString()
  }
}
