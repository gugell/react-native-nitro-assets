#!/bin/bash
set -euo pipefail

# Exercises scripts/release.sh on every path with a stubbed release-it, so
# nothing is published, committed or tagged (adapted from expo-native-config).
#
# The real release path and the dry-run path differ in one way that matters:
# the `offline` and `flags` arrays are EMPTY on a real release. Under `set -u`,
# bash 3.2 (what macOS ships) treats expanding an empty array as an unbound
# variable, so a script verified only with --dry-run can still fail on the day
# it is used for real.

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stub="$(mktemp -d)"
trap 'rm -rf "$stub"' EXIT

cat > "$stub/release-it" <<STUB
#!/bin/bash
for arg in "\$@"; do
  case "\$arg" in
  --release-version)
    # Answer a prerelease request with a prerelease version, so the script is
    # exercised on the shape it will really see.
    for other in "\$@"; do
      case "\$other" in
      --preRelease=*) echo "9.9.9-\${other#--preRelease=}.0"; exit 0 ;;
      esac
    done
    echo "9.9.9"
    exit 0
    ;;
  esac
done
echo "\$*" >> "$stub/calls"
exit 0
STUB
chmod +x "$stub/release-it"

run() {
  local label="$1"
  local expected="$2"
  shift 2
  local output
  : > "$stub/calls"
  if ! output="$(RELEASE_IT="$stub/release-it" GITHUB_TOKEN=stub bash "$root/scripts/release.sh" "$@" 2>&1)"; then
    echo "release.sh failed on the $label path:" >&2
    echo "$output" >&2
    exit 1
  fi
  case "$output" in
  *"Releasing version $expected"*) ;;
  *)
    echo "release.sh did not resolve a version on the $label path:" >&2
    echo "$output" >&2
    exit 1
    ;;
  esac
  echo "  $label path ok"
}

# What reached release-it, as opposed to what the script printed.
calls() { cat "$stub/calls"; }

run "release (empty flag arrays)" 9.9.9 --no-increment
# --no-increment means "publish what the manifest already says". Passing the
# version positionally as well makes npm version fail with "Version not changed".
if calls | grep -q "9\.9\.9"; then
  echo "release.sh passed a version positionally alongside --no-increment:" >&2
  calls >&2
  exit 1
fi
echo "    and did not pass a version positionally"

run "dry-run (populated flag arrays)" 9.9.9 --dry-run
run "explicit increment" 9.9.9 minor
if [ "$(calls | grep -c "9\.9\.9")" -ne 2 ]; then
  echo "release.sh did not pass the resolved version to both passes:" >&2
  calls >&2
  exit 1
fi
echo "    and passed the resolved version to both passes"

# A prerelease must reach BOTH passes, or the registry would carry 9.9.9-alpha.0
# while the tag said 9.9.9.
run "prerelease" 9.9.9-alpha.0 --preRelease=alpha
if [ "$(calls | grep -c -- "--preRelease=alpha")" -ne 2 ] || [ "$(calls | grep -c "9\.9\.9-alpha\.0")" -ne 2 ]; then
  echo "release.sh did not forward the prerelease to both passes:" >&2
  calls >&2
  exit 1
fi
echo "    and forwarded the prerelease to both passes"

echo "release.sh runs on every path."
