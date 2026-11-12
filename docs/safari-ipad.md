# AstroChart Bridge in Safari on iPad

Safari on iPadOS runs web extensions only from inside an app, so AstroChart Bridge has to be wrapped in one with Xcode. `tools/package-safari.sh` makes that Xcode project from `extension/`. The same project also builds the Mac app.

## What has been checked

Checked on a Mac with Xcode 26.1, on 1 November 2026:

- `tools/package-safari.sh` makes one project with an app and an extension for macOS, and an app and an extension for iOS. The iOS ones are for iPhone and iPad.
- The macOS app builds without signing, and its extension holds exactly the files in `extension/`.
- Apple's documentation lists every extension API the popup uses as supported in Safari on iOS and iPadOS, and Safari accepts the `chrome` name the code uses.

Not checked yet:

- Building the iOS app. That Mac had no iOS platform installed in Xcode.
- Anything on an iPad. Everything under "Install on an iPad" below comes from Apple's documentation and hasn't been followed on a device yet. Test 18 in `docs/manual-test.md` is the list to run there.

## What you need

- A Mac with Xcode 26 or later and its iOS platform. Get the platform in **Xcode → Settings → Components**, or run `xcodebuild -downloadPlatform iOS`. It's a download of several GB.
- An iPad on iPadOS 26 or later. The manifest needs Safari 26, and Safari on iPadOS is updated only with the system.
- An Apple Account added in **Xcode → Settings → Apple Accounts**.

Whether a free account is enough to run the extension on your own iPad isn't settled:

- Apple's [membership comparison](https://developer.apple.com/support/compare-memberships/) says a free account can install apps on your own devices. Those apps stop opening after 7 days.
- Apple's page on [running a Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension) says testing on a device needs the Apple Developer Program.

TestFlight and the App Store need the paid Apple Developer Program.

## Make the Xcode project

```bash
npm run package:safari -- com.yourname.astrochartbridge
```

This runs `tools/package-safari.sh`, which you can also run directly. Use a bundle identifier that your Apple team can register; `com.example.astrochartbridge` is only a placeholder. The project is written to `build/safari/`, which git ignores.

The project points at the files in `extension/` instead of copying them, so a change to an existing file is in the next build. **Run the script again after adding, removing or renaming a file in `extension/`**, because the project lists each file by name.

The script sets the iOS targets to iPadOS 26. Apple's template sets iOS 15, which is older than the Safari 26 the manifest needs.

## Install on an iPad

1. Connect the iPad to the Mac and open `build/safari/AstroChart Bridge/AstroChart Bridge.xcodeproj`.
2. Select the project in Xcode's navigator. For each of the targets **AstroChart Bridge (iOS)** and **AstroChart Bridge Extension (iOS)**, open **Signing & Capabilities** and choose your team.
3. Choose the scheme **AstroChart Bridge (iOS)** and your iPad as the destination.
4. On the iPad, turn on **Settings → Privacy & Security → Developer Mode** and restart it. The switch appears only after the iPad has been connected to Xcode. [Apple's steps](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
5. In Xcode, choose **Product → Run**. The AstroChart Bridge app opens on the iPad and says how to turn the extension on.
6. Turn on AstroChart Bridge in Safari's extension settings, under **Settings → Apps → Safari → Extensions**. You can also go through **Manage Extensions** in the menu in Safari's address bar.

Using it:

- On a chart's tab, tap the menu in the address bar, then **AstroChart Bridge**. That gives the extension access to that tab only, as clicking its toolbar icon does on a Mac.
- Safari may ask whether AstroChart Bridge can see the page. If it does, allow it for that site or for one use.

To inspect the popup, turn on **Settings → Apps → Safari → Advanced → Web Inspector** on the iPad. Then, in Safari on the Mac, choose the iPad from the **Develop** menu and pick AstroChart Bridge's popup.

## Distribution

These need the paid Apple Developer Program. Nothing here has been tried.

- **TestFlight or the App Store:** in Xcode, choose **Product → Archive** for each platform, then upload the archives to App Store Connect. The template gives the Mac and iPad apps the same bundle identifier, so one App Store record can hold both.
- **App Store Connect's packager:** App Store Connect can package a web extension without Xcode. It uses the account's Xcode Cloud hours. [Apple's guide](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
- **Leave Helioscope and parans out of either.** Swiss Ephemeris is under the AGPL, whose terms and the App Store's may conflict ([HELIOSCOPE_V1_FEASIBILITY.md](HELIOSCOPE_V1_FEASIBILITY.md), §4). `tools/package-safari.sh` links to `extension/` as it is, so make a TestFlight or App Store build's project from a copy without their files, such as `git archive` writes with exclude pathspecs:
  - Helioscope's: `helioscope.html`, `helioscope.js`, `helioscope.css`, `helioscope-model.js`, `helioscope-view.js`, `helioscope-engine.js` and `core/helioscope.js`
  - the parans page's: `parans.html`, `parans.js`, `parans.css`, `parans-model.js`, `parans-view.js` and `core/parans.js`
  - and `vendor/swisseph/`, which both use.

  Whatever opens either page has to go too: the Which planets were visible and Parans buttons, which `popup-model.js`'s `chartButtons`, `aaf-model.js`, `hor-model.js` and `chart-model.js` add to the chart screens. Builds for your own devices can keep them.

## Known risks to check on an iPad

Test 18 in `docs/manual-test.md` covers these:

- **Opening astro.com's form:** **Open astro.com's form** opens astro.com in a background tab, keeps the values for it, then brings it to the front.
  - [A WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=286759) and an [Apple forum report](https://developer.apple.com/forums/thread/774313) say Safari on iOS 18.3 and later brings such a tab to the front at once.
  - If that happens, the popup could close before the values are kept. **Open Stellarium Web** doesn't open tabs this way.
- **Screenshot reading:** WebKit bug reports say iOS gives WebAssembly less memory than a Mac. Tesseract.js, which reads screenshots, may run out of memory on some iPads.
- **The page Astro-Seek serves:** iPads usually ask websites for their desktop pages, but Apple names iPad mini as one that may get a site's mobile layout.
  - AstroChart Bridge reads the date, time and place from the address and checks them against the page's text.
  - A mobile page that prints them differently would most likely be refused. Wrong values are unlikely, but neither has been tried.
- **Popup size:** with a finger as the main pointer, the popup uses 44-point buttons and larger text (`popup.css`, `pointer: coarse`). With a trackpad attached, Safari may report the trackpad as the main pointer instead, and then the popup keeps its desktop sizes.
