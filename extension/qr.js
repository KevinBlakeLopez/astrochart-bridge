// A shared chart's link as a QR code, made on the device with the vendored
// lean-qr, as one SVG path the page can draw without loading anything.
import { correction, generate, mode } from "./vendor/lean-qr/index.mjs";

// Medium error correction survives a smudged screen or a glare spot. A link of
// about 400 characters is then version 15, 77 modules a side.
// Byte mode with no ECI: a link is ASCII, and every scanner reads that.
export const MAX_QR_VERSION = 20;
export const QR_OPTIONS = Object.freeze({
  minCorrectionLevel: correction.M,
  maxVersion: MAX_QR_VERSION,
  modes: [mode.ascii],
});

// The light margin a scanner needs around the code, in modules.
export const QUIET_ZONE = 4;

// lean-qr's error code when the text doesn't fit in maxVersion.
const TOO_LONG = 4;

/**
 * The QR code for a link: size is modules a side with the quiet zone, and
 * path draws the dark modules in those coordinates, each row's runs as
 * "M x,y h n v1 h-n z". Past version 20 the modules get too small to scan
 * reliably from a screen, so a longer link is refused.
 *
 * @param {string} link
 * @returns {{ kind: "qr", version: number, size: number, path: string } | { kind: "refused", reason: "too-long" }}
 */
export function qrFor(link) {
  let code;
  try {
    code = generate(link, QR_OPTIONS);
  } catch (error) {
    if (error?.code === TOO_LONG) return { kind: "refused", reason: "too-long" };
    throw error;
  }

  let path = "";
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; ) {
      if (!code.get(x, y)) {
        x++;
        continue;
      }
      let run = 1;
      while (code.get(x + run, y)) run++;
      path += `M${x + QUIET_ZONE},${y + QUIET_ZONE}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return { kind: "qr", version: (code.size - 17) / 4, size: code.size + 2 * QUIET_ZONE, path };
}
