// Where Which planets were visible opens Helioscope's page. null, as here,
// opens the copy beside the page the button is on: the extension's own, or
// the site's. The App Store's Safari build leaves Helioscope and Swiss
// Ephemeris out (docs/safari-ipad.md), so tools/app-store.mjs writes this file
// into that build with the web's copy of Helioscope's page, beside the
// receiving page in share-config.js.
export const HELIOSCOPE_URL = null;
