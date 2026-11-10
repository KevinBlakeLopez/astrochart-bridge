// Which copy of a page is running. The receiving page and the import pages
// are published twice: in the extension, which can open tabs, ask for access
// to a site and fill in its form, and on the web, which can do none of that.
// Each page asks once, with its own address, and offers only what its copy can do.
//
// Every browser gives its extension's pages a scheme of their own ending in
// "-extension:": moz-extension: in Firefox, chrome-extension: in Chrome and
// Edge, safari-web-extension: in Safari. Everything else, https: on the web
// or http: for a copy of the site served on this computer, is the web's copy.

/**
 * @param {string} href  the page's own address, location.href
 * @returns {boolean}  true for the extension's copy
 */
export const isExtensionCopy = (href) => new URL(href).protocol.endsWith("-extension:");
