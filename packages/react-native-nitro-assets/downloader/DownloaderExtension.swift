import BackgroundAssets
import ExtensionFoundation
import StoreKit

/// Apple-hosted, managed downloader extension (Xcode's "Background Download" template). The system
/// downloads every essential and prefetch asset pack for the current install or update event;
/// `shouldDownload` could filter some out at runtime.
@main
struct DownloaderExtension: StoreDownloaderExtension {
  func shouldDownload(_ assetPack: AssetPack) -> Bool {
    return true
  }
}
