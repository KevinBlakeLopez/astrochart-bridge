#!/bin/sh
# Makes the Xcode project for the App Store's and TestFlight's Safari app: the
# same app as tools/package-safari.sh makes, around a copy of extension/ from
# a commit, less what tools/store-leave-out.txt and
# tools/app-store-leave-out.txt list. That leaves Helioscope and Swiss
# Ephemeris out, and tools/app-store.mjs points the copy's Which planets were
# visible at the web's copy of Helioscope's page (docs/safari-ipad.md).
#
#   npm run package:app-store -- [commit] [bundle-identifier]
#
# or tools/package-app-store.sh [commit] [bundle-identifier]. The commit
# defaults to main, as for the store zips, so the app gets exactly what was
# committed and tested. The copy is written to build/app-store/extension/ and
# the project to build/safari-app-store/, replacing what was there; the
# project refers to the copy's files, so keep both.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
commit=${1:-main}
bundle_id=${2:-com.example.astrochartbridge}
copy="$root/build/app-store/extension"

hash=$(git -C "$root" rev-parse --verify --quiet "$commit^{commit}") || {
  echo "$commit isn't a commit" >&2
  exit 1
}
# A commit from before the App Store's list would carry Helioscope into the
# build, so it's refused rather than packed.
git -C "$root" cat-file -e "$hash:tools/app-store-leave-out.txt" 2>/dev/null || {
  echo "$commit has no tools/app-store-leave-out.txt, so its build would carry Helioscope" >&2
  exit 1
}
leave_out=$(
  {
    git -C "$root" show "$hash:tools/store-leave-out.txt" 2>/dev/null || true
    git -C "$root" show "$hash:tools/app-store-leave-out.txt"
  } | sed -e '/^#/d' -e '/^$/d' -e 's/^/:(exclude)/'
)

rm -rf "$root/build/app-store"
mkdir -p "$copy"
# $leave_out is unquoted on purpose: one pathspec per word.
git -C "$root" archive --format=tar "$hash:extension" -- . $leave_out | tar -x -C "$copy"
node "$root/tools/app-store.mjs" "$copy"

EXTENSION_DIR="$copy" SAFARI_OUT="$root/build/safari-app-store" "$root/tools/package-safari.sh" "$bundle_id"
echo "Packed from $commit ($(git -C "$root" rev-parse --short "$hash")), without:"
printf '  %s\n' $leave_out | sed 's/:(exclude)//'
