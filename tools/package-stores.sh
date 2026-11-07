#!/bin/sh
# Makes the files the Chrome Web Store and Firefox Add-ons take. They are
# packed from a commit, not the working tree, so a store gets exactly what was
# committed and tested, and nothing untracked, such as a .DS_Store or a stray
# capture, rides along.
#
#   npm run package:stores -- [commit]
#
# or tools/package-stores.sh [commit]. The commit defaults to main.
#
# Two zips are written to build/stores/, replacing what was there:
#
#   astrochart-bridge-<version>.zip         extension/, with manifest.json at
#                                           its top, less the paths
#                                           tools/store-leave-out.txt lists.
#                                           Both stores take this file.
#   astrochart-bridge-<version>-source.zip  the whole repository at the commit,
#                                           for a Firefox reviewer who asks for
#                                           the source. There's no build step,
#                                           so its extension/ is the same files,
#                                           and those left out.
#
# Each upload to a store needs a version it hasn't had before. See
# docs/store-listing.md for what each store asks for alongside the zip.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
commit=${1:-main}
out="$root/build/stores"

hash=$(git -C "$root" rev-parse --verify --quiet "$commit^{commit}") || {
  echo "$commit isn't a commit" >&2
  exit 1
}
version=$(git -C "$root" show "$hash:extension/manifest.json" |
  node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version')

# What tools/store-leave-out.txt in the packed commit leaves out of the
# extension's zip, one git pathspec each. Older commits don't have the file.
leave_out=$(git -C "$root" show "$hash:tools/store-leave-out.txt" 2>/dev/null | sed -e '/^#/d' -e '/^$/d' -e 's/^/:(exclude)/' || true)

rm -rf "$out"
mkdir -p "$out"
# $leave_out is unquoted on purpose: one pathspec per word.
git -C "$root" archive --format=zip -o "$out/astrochart-bridge-$version.zip" "$hash:extension" -- . $leave_out
git -C "$root" archive --format=zip --prefix="astrochart-bridge-$version/" \
  -o "$out/astrochart-bridge-$version-source.zip" "$hash"

echo "Packed version $version from $commit ($(git -C "$root" rev-parse --short "$hash")) into $out:"
ls -l "$out"
if [ -n "$leave_out" ]; then
  echo "Left out of the extension's zip, as tools/store-leave-out.txt lists:"
  printf '  %s\n' $leave_out | sed 's/:(exclude)//'
fi
