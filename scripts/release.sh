#!/bin/bash
set -euo pipefail

# Release in two passes, as react-native-nitro-cloudkit does:
#
#   1. packages/react-native-nitro-assets publishes ITSELF to npm (git and GitHub
#      disabled in its own release-it config), then
#   2. the repository root makes the version bump commit, the tag and the GitHub
#      release (npm disabled there).
#
# Both passes get the same arguments, so they agree on the version:
#   ./scripts/release.sh minor
#   ./scripts/release.sh --dry-run
#   ./scripts/release.sh --no-increment --ci --npm.skipChecks

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
release_it="$root/node_modules/.bin/release-it"

dry_run=false
for argument in "$@"; do
  case "$argument" in
  --dry-run | -d) dry_run=true ;;
  esac
done

# A dry run is an offline rehearsal: it computes the next version and changelog
# from local history without contacting npm, GitHub or the remote.
offline=()
if [ "$dry_run" = true ]; then
  offline=(
    --ci
    --no-npm.publish
    --npm.skipChecks
    --no-github.release
    --no-git.push
    --no-git.requireUpstream
    --no-git.requireBranch
    --no-git.requireCleanWorkingDir
  )
fi

if [ "$dry_run" = false ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  if [ -n "${GH_TOKEN:-}" ]; then
    export GITHUB_TOKEN="$GH_TOKEN"
  elif command -v gh >/dev/null 2>&1 && token="$(gh auth token 2>/dev/null)" && [ -n "$token" ]; then
    export GITHUB_TOKEN="$token"
  else
    echo "error: GITHUB_TOKEN is required to create the GitHub release." >&2
    echo "Run 'gh auth login', export a token with repo scope, or rehearse with --dry-run." >&2
    exit 1
  fi
fi

# Resolve ONE version for both passes; otherwise the package takes release-it's
# default patch bump while the root reads the conventional commits.
flags=()
no_increment=false
for argument in "$@"; do
  case "$argument" in
  --no-increment) no_increment=true; flags+=("$argument") ;;
  -*) flags+=("$argument") ;;
  esac
done

# ${arr[@]+"${arr[@]}"}: macOS's bash 3.2 treats an empty array as unbound under set -u.
version_log="$(mktemp)"
if ! version="$("$release_it" --release-version "$@" ${offline[@]+"${offline[@]}"} 2>"$version_log")"; then
  echo "error: could not determine the next version. Pass one explicitly, e.g. 'minor' or '0.1.0'." >&2
  cat "$version_log" >&2
  rm -f "$version_log"
  exit 1
fi
rm -f "$version_log"
version="$(printf '%s\n' "$version" | tail -1)"
[ -n "$version" ] || { echo "error: release-it did not report a version." >&2; exit 1; }
echo "Releasing version $version"

# With --no-increment, passing the version positionally as well would make
# npm version fail with "Version not changed".
positional=("$version")
if [ "$no_increment" = true ]; then
  positional=()
fi

echo "Publishing react-native-nitro-assets to npm"
(cd packages/react-native-nitro-assets && "$release_it" ${positional[@]+"${positional[@]}"} ${flags[@]+"${flags[@]}"} ${offline[@]+"${offline[@]}"})

echo "Creating the version bump commit, tag and GitHub release"
"$release_it" ${positional[@]+"${positional[@]}"} ${flags[@]+"${flags[@]}"} ${offline[@]+"${offline[@]}"}

echo "Released react-native-nitro-assets $version."
