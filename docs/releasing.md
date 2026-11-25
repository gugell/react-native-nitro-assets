# Releasing

`react-native-nitro-assets` is released with release-it in two passes, the same flow as react-native-nitro-cloudkit:

1. `packages/react-native-nitro-assets` publishes itself to npm. Its `release-it` block has git and GitHub turned off; `before:init` runs `bun run check`, and `after:bump` builds `lib/` and packs `package.tgz`, which is what npm publishes and what `bun run pack:check` verifies.
2. The repository root makes one version commit (`chore: release vX.Y.Z`), the `vX.Y.Z` tag and the GitHub release. npm is off there; `@release-it/bumper` writes the version into the package and the example app, and `@release-it/conventional-changelog` writes `packages/react-native-nitro-assets/CHANGELOG.md`.

`scripts/release.sh` runs both with the same arguments, so they agree on the version. `bun run release:dry-run` rehearses offline: it computes the version and changelog from local history and contacts nothing.

## Before a release

```sh
bun install --frozen-lockfile
bun run generated:check   # nitrogen output matches the specs
bun run check
bun run pack:check
```

CI runs these and builds the example for the iOS simulator and for Android. On a device, run the example's device tests (see the package README).

## The first version: `bun run release:first`

npm can only trust a workflow for a package that already exists, so the package owner publishes 0.1.0 once, from a terminal, on an up-to-date and clean `main`:

```sh
bun run release:first
```

`scripts/first-publish.sh` then:

1. checks the checkout and that the package is not on npm yet;
2. signs in to npm if needed;
3. creates the `npm` environment in the GitHub repository;
4. runs the package pass without publishing (check, bump to 0.1.0, pack);
5. publishes `package.tgz` with `npm publish`, which asks for the npm security key in the browser. If it fails, nothing is tagged and the script can be run again;
6. runs the root pass: release commit, `v0.1.0` tag, GitHub release;
7. registers the Release workflow as a trusted publisher (`npm trust github … --file release.yml --environment npm`, with npm 11), which asks for the key again.

Then, on `https://www.npmjs.com/package/react-native-nitro-assets/access`, "Require two-factor authentication and disallow tokens" leaves the workflow as the only way to publish.

## Later versions: the Release workflow

Actions → Release → Run workflow, on `main`. This is the same workflow as expo-native-config, whose first versions were published by hand and every version since 0.3.0 by this workflow, with provenance.

| Input        | Options                                      | Meaning                                                                                                                                  |
| ------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `increment`  | `auto`, `patch` (default), `minor`, `major`, `initial` | `auto` passes no increment and lets the conventional commits decide; `initial` publishes the version already in the manifest |
| `prerelease` | `none`, `alpha`, `beta`, `rc`                | Adds `--preRelease=<id>` and publishes under that dist-tag; running it again advances `alpha.0` to `alpha.1`                             |

`initial` with a prerelease is rejected before anything runs. `bun run release:check` runs `scripts/release.sh` on every path with a stubbed release-it (empty and populated flag lists, `--no-increment`, an explicit increment, a prerelease reaching both passes); CI runs it.

The job runs `generated:check`, `check` and `pack:check`, then releases through npm trusted publishing: `id-token: write`, the `npm` environment (already created in the repository, with no protection rules, as in expo-native-config), and npm 11. There is no npm token anywhere. Provenance is attached because `repository` in the package's `package.json` matches this repository exactly.

Failure modes:

- **`npm error 404 Not Found - PUT https://registry.npmjs.org/react-native-nitro-assets`**: the trusted publisher is missing or does not match (owner `gugell`, repository `react-native-nitro-assets`, workflow `release.yml`, environment `npm`). npm reports this as 404, not as an auth error; expo-native-config's first two workflow runs failed exactly this way.
- **`npm error need auth`**: the same cause on older npm versions.
- **Published without a provenance badge**: check the `repository` field; if it matches, add `--provenance` to `publishArgs`.
