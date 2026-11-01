#!/bin/sh
# Makes the Xcode project that wraps extension/ in an app for Safari on macOS
# and on iPadOS (and iPhone). The project is Apple's template around links to
# the files in extension/, so it isn't kept in the repo: run this again
# whenever you need it. Needs Xcode 26 or later.
#
#   tools/package-safari.sh [bundle-identifier]
#
# The project is written to build/safari/, replacing what was there. The
# bundle identifier defaults to com.example.chartbridge; signing needs one
# your Apple team can register. See docs/safari-ipad.md.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
bundle_id=${1:-com.example.chartbridge}
out="$root/build/safari"

xcrun safari-web-extension-packager "$root/extension" \
  --project-location "$out" \
  --app-name "Chart Bridge" \
  --bundle-identifier "$bundle_id" \
  --swift --no-open --no-prompt --force

# The template targets iOS 15. The manifest needs Safari 26, and Safari on
# iPadOS comes with the system, so the app needs iPadOS 26 too. macOS keeps the
# template's target: Safari there updates on its own, and the manifest's
# strict_min_version stops an older one loading the extension.
project="$out/Chart Bridge/Chart Bridge.xcodeproj/project.pbxproj"
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]*;/IPHONEOS_DEPLOYMENT_TARGET = 26.0;/' "$project"

echo "Open $out/Chart Bridge/Chart Bridge.xcodeproj in Xcode."
