# react-native-nitro-assets

![Demo: configure a pack, build it with nitro-assets package, deliver it per platform, and the device tests passing on an iPhone 13 Pro Max](docs/demo/demo.gif)

[Watch the demo in full resolution (MP4)](docs/demo/demo.mp4)

Deliver large files — ML models, media, game data — to React Native apps without putting them in the binary: Apple-hosted Background Assets on iOS 26+, On-Demand Resources below, Google Play Asset Delivery on Android, behind one API, with an Expo config plugin and a `nitro-assets` command that builds Apple-hosted packs.

**[Read the package documentation](packages/react-native-nitro-assets/README.md).**

| Path                                  | What                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| `packages/react-native-nitro-assets`  | The npm package: TypeScript client, Swift and Kotlin backends, config plugin, downloader extension, CLI |
| `apps/example`                        | Expo example app with a demo pack and on-device tests                 |
| `docs/releasing.md`                   | How versions are published                                            |

```sh
bun install
bun run check        # build, typecheck, lint, format, tests
bun run pack:check   # installs the packed tarball into a fresh project and uses it
```

MIT licensed.
