#!/bin/bash
set -euo pipefail

# The first publication of react-native-nitro-assets, run once by the package
# owner in a terminal. Later releases go through the Release workflow, which
# publishes with npm trusted publishing (no token, no 2FA prompt).
#
# A trusted publisher can only be configured on a package that exists, so the
# first version has to be published by hand. That publish asks for your npm
# second factor (security key) in the browser, which needs a terminal: this
# script publishes with npm directly instead of through release-it.
#
#   bun run release:first            # publishes 0.1.0
#   bun run release:first 0.1.0-rc.0

package=react-native-nitro-assets
repository=gugell/react-native-nitro-assets
version="${1:-0.1.0}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

step() { printf '\n==> %s\n' "$*"; }

step "Checking the checkout"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "error: switch to main first." >&2; exit 1; }
git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "error: main is not origin/main; pull or push first." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "error: the working tree is not clean." >&2; exit 1; }
if curl -fsS "https://registry.npmjs.org/$package" >/dev/null 2>&1; then
  echo "error: $package already exists on npm. Use the Release workflow instead." >&2
  exit 1
fi
command -v gh >/dev/null || { echo "error: the GitHub CLI (gh) is required." >&2; exit 1; }

step "Signing in to npm (skipped when already signed in)"
npm whoami >/dev/null 2>&1 || npm login
echo "npm user: $(npm whoami)"

step "Creating the 'npm' GitHub environment the Release workflow publishes from"
gh api --method PUT "repos/$repository/environments/npm" --silent

release_it="$root/node_modules/.bin/release-it"
GITHUB_TOKEN="$(gh auth token)"
export GITHUB_TOKEN

step "Checking, building and packing $version (the package's own release-it pass, without publishing)"
(cd "packages/$package" && "$release_it" "$version" --ci --no-npm.publish)

step "Publishing $package@$version to npm: confirm with your security key when npm asks"
if ! (cd "packages/$package" && npm publish package.tgz --access public); then
  echo "error: npm publish failed; nothing was tagged. Fix it, then run this script again." >&2
  git checkout -- "packages/$package/package.json"
  exit 1
fi

step "Creating the release commit, tag v$version and the GitHub release"
"$release_it" "$version" --ci

step "Trusting the Release workflow to publish later versions (npm 11; asks for your key again)"
npx --yes npm@11 trust github "$package" --file release.yml --repository "$repository" \
  --environment npm --allow-publish --allow-stage-publish

echo
echo "Published $package@$version, tagged v$version and created the GitHub release."
echo "Optional: on https://www.npmjs.com/package/$package/access choose"
echo "'Require two-factor authentication and disallow tokens', so only the workflow can publish."
