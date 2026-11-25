# react-native-nitro-assets

Deliver large files — ML models, media, game data — to a React Native app without putting them in the app binary. One API over each platform's own delivery system:

| Platform     | Backend                                                                                                                     | When                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| iOS 26+      | [Apple-hosted Background Assets](https://developer.apple.com/documentation/backgroundassets) (`AssetPackManager`)           | `ios.backgroundAssets` is set and the app ships what it needs |
| iOS below 26 | [On-Demand Resources](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/On_Demand_Resources_Guide/) | `ios.odr` is set                                       |
| Android      | [Play Asset Delivery](https://developer.android.com/guide/playcore/asset-delivery)                                          | `android.playAssetDelivery` is set                     |

Built on [Nitro Modules](https://nitro.margelo.com), with an Expo config plugin and a `nitro-assets` command that builds Apple-hosted packs.

## Install

```sh
npx expo install react-native-nitro-assets react-native-nitro-modules
```

Peers: `react-native >= 0.78`, `react-native-nitro-modules 0.37.x`, and `expo >= 52` for the config plugin. This needs a development build; Expo Go cannot load it.

## Use

```ts
import { AssetsError, createAssets } from 'react-native-nitro-assets';
import { createNativeAdapter } from 'react-native-nitro-assets/native';

const assets = createAssets({ adapter: createNativeAdapter() });

await assets.ensureAvailable('intent-model', { onProgress: (fraction) => setProgress(fraction) });
const modelUrl = await assets.getFileUrl('intent-model', 'model.pte'); // file:///…/intent-model/model.pte
```

| Method                                 | Does                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `getStatus(packId)`                    | `{ packId, state: 'available' \| 'downloading' \| 'not-downloaded', isUpdateAvailable, downloadSizeBytes? }` |
| `ensureAvailable(packId, options?)`    | Resolves once the pack is on the device; downloads it first if needed. Options: `onProgress`, `requireLatestVersion`, `timeoutMs` |
| `getFileUrl(packId, relativePath)`     | A `file://` URL of a file inside a pack that is on the device                                          |
| `remove(packId)`                       | Deletes the pack (ODR: stops using it, so the system may purge it)                                     |
| `backend`, `isSupported`               | Which backend this device uses (`background-assets`, `on-demand-resources`, `play-asset-delivery`, `memory`, `none`) |

Concurrent `ensureAvailable` calls for one pack share one download, each with its own progress. Every failure is an `AssetsError` with a `code` to branch on, a `packId` and `retryable`:

| `code`                       | Means                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `misconfigured`              | The build is missing something the backend needs (the message names it). A developer error            |
| `pack_not_found`             | The store, or this build, has no such pack                                                             |
| `pack_not_downloaded`        | Call `ensureAvailable` first                                                                           |
| `file_not_found`             | The pack has no file at that path                                                                      |
| `store_unavailable`          | The store cannot serve this install (sideloaded or debug build, version not published)                |
| `network`, `not_allowed`, `timeout` | Retryable: offline, the system refused right now, or the deadline passed                       |
| `insufficient_storage`, `user_confirmation_required`, `cancelled`, `unsupported_os`, `unsupported_platform`, `invalid_argument`, `unknown` | As named |

`react-native-nitro-assets/memory` provides `createMemoryAdapter({ packs })`, a simulated store for tests, the web, and the simulator.

## Configure

Each pack is a folder. Its contents become the pack root: `asset-packs/intent-model/model.pte` is read as `getFileUrl('intent-model', 'model.pte')`.

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-nitro-assets",
        {
          "packs": { "intent-model": { "path": "./asset-packs/intent-model" } },
          "ios": {
            "backgroundAssets": {
              "appGroupId": "group.com.example.app",
              "packs": { "intent-model": "essential" }
            },
            "odr": { "packs": { "intent-model": "initial-install" } }
          },
          "android": { "playAssetDelivery": { "packs": { "intent-model": "install-time" } } }
        }
      ]
    ]
  }
}
```

| Option                         | Values                                                  | Notes                                                                                                   |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packs[id].path`               | A folder, relative to the project root                  | Pack ids: a letter, then letters, digits, `-` or `_`, at most 64                                        |
| `ios.backgroundAssets.packs`   | `essential`, `prefetch`, `on-demand` (default)          | `essential`: downloaded with the install, before the app can open. `prefetch`: starts with the install |
| `ios.backgroundAssets.appGroupId` | `group.<id>`                                         | Default `group.<ios.bundleIdentifier>`. Added to the app's entitlements                                 |
| `ios.odr.packs`                | `initial-install`, `prefetch`, `on-demand`              | Folders are bundled into the build and tagged. Also the fallback on iOS 26 when Background Assets cannot run |
| `android.playAssetDelivery.packs` | `install-time`, `fast-follow`, `on-demand`           | One asset-pack Gradle module per pack (`-` becomes `_` in its name)                                     |

Set any section to `false` (or leave it out) to turn it off.

### Background Assets needs a downloader extension

Apple-hosted packs are fetched by a downloader extension that ships inside the app. This package contains one (`react-native-nitro-assets/downloader`, a `StoreDownloaderExtension`); add it with [expo-native-config](https://github.com/gugell/expo-native-config), which needs its `background-download` target type:

```ts
// workspace.config.ts
export default {
  ios: { targets: [{ package: 'react-native-nitro-assets/downloader', bundleIdentifier: '.AssetDownloader' }] },
};
```

and `"expo-native-config/plugin"` last in `expo.plugins`. The extension inherits the app group.

The provisioning profiles of the app and the extension must include that app group. With automatic signing, Xcode registers it the first time it signs with an Apple ID that is signed in under Xcode → Settings → Accounts. An App Store Connect API key cannot create app groups.

Without the extension or the app group, iOS would stop the app the first time Background Assets is used. The module checks for both first: it uses On-Demand Resources when `ios.odr` is set, and otherwise fails every call with `misconfigured`, naming what is missing.

## Build and upload Apple-hosted packs

```sh
npx nitro-assets package                  # every pack in ios.backgroundAssets.packs
npx nitro-assets package intent-model     # or some of them
```

writes `asset-packs-out/<packId>.aar` (macOS, Xcode 26). Each archive holds the pack's files under `<packId>/` and a manifest with its download policy. Add `asset-packs-out/` to `.gitignore`.

Upload each archive to the app's record in App Store Connect, with Transporter (drag the `.aar` in, choose the app, Deliver) or:

```sh
xcrun altool --upload-asset-pack asset-packs-out/intent-model.aar --apple-id <the app's Apple ID> \
  --api-key <key id> --api-issuer <issuer id>
xcrun altool --list-asset-pack-versions --apple-id <the app's Apple ID> --asset-pack-identifier intent-model \
  --api-key <key id> --api-issuer <issuer id>
```

The app's Apple ID is the number under App Information. Uploading a pack is separate from uploading a build, and each upload becomes a new version of the pack. After **Processing** (Apple emails when it is done):

- **TestFlight, internal testers** get the latest processed version automatically: TestFlight → Builds & Assets → Asset Packs.
- **TestFlight, external testers**: on that page, Set Up External Testing (or Replace), choose the version, Submit for Review.
- **App Store**: Distribution → the version page → Select Asset Pack → add the version to the submission, with the app version or on its own.

Apple-hosted packs download only in TestFlight and App Store installs, or from a mock server in development (below). An essential pack counts toward the install, so the app opens with the pack already on the device. Resolve file URLs with `getFileUrl` on every launch rather than storing them.

### Test without TestFlight

A development build can download its packs from `ba-serve`, Apple's mock server, running on your Mac. Background Assets downloads only over HTTPS, so:

1. Create a root certificate authority, install it on the iPhone and trust it (Settings → General → About → Certificate Trust Settings).
2. With that authority, issue an SSL certificate for the Mac's LAN address or host name, and keep it with its private key in the Mac's keychain. Apple's [Testing asset packs locally](https://developer.apple.com/documentation/backgroundassets/testing-asset-packs-locally) covers both steps.
3. Serve the archives on a fixed port, so the device setting stays valid:

   ```sh
   xcrun ba-serve asset-packs-out/intent-model.aar --host <the Mac's LAN address> --port 61132
   ```

   It asks which keychain identity to use (`--choose-identity-automatically` skips the question).

4. On the iPhone, enter the server's base URL (`https://<address>:61132`) under Settings → Developer → Development Overrides.
5. Build and install the development build. Its essential packs then come from the mock server. Remove the override when you are done.

## Example app and device tests

`apps/example` in the repository runs the client and native contract on a device: tap **Run device tests**, or launch it with `<scheme>://run-tests`. Results are saved after every test to `Documents/nitro-assets-tests.json`:

```sh
xcrun devicectl device process launch --device <id> --payload-url com.gugell.nitroassets.example://run-tests com.gugell.nitroassets.example
xcrun devicectl device copy from --device <id> --domain-type appDataContainer \
  --domain-identifier com.gugell.nitroassets.example --source Documents/nitro-assets-tests.json --destination .
```

## License

MIT
