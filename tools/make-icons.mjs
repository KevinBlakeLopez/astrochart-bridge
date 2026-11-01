// Draws AstroChart Bridge's icon, a star above an arch on a night-blue square, at
// every size the manifest lists. Run it after changing the drawing:
//
//   node tools/make-icons.mjs
//
// The square is filled to the edges because iPadOS rounds an app icon's
// corners itself. Nothing but Node is needed: each pixel's colour is worked
// out from the shapes below and written as an uncompressed-filter PNG.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

export const SIZES = [16, 32, 48, 96, 128, 256, 512, 1024];

const NIGHT = [11, 29, 58];
const STAR = [245, 196, 81];
const ARCH = [138, 180, 248];

// Shapes in a unit square, y down. Later shapes are drawn over earlier ones.
const SHAPES = [
  // An arch: a ring around a centre below the square, so only its top shows.
  [ARCH, (x, y) => Math.abs(Math.hypot(x - 0.5, y - 1.08) - 0.5) < 0.055 && y < 0.86],
  // A four-pointed star: |dx|^½ + |dy|^½ ≤ r^½ curves in between the points.
  [STAR, (x, y) => Math.sqrt(Math.abs(x - 0.5)) + Math.sqrt(Math.abs(y - 0.36)) <= Math.sqrt(0.26)],
];

// Each pixel is sampled on a 4 × 4 grid, so edges are smooth at 16 pixels too.
const GRID = 4;

function pixel(size, px, py) {
  const sum = [0, 0, 0];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = (px + (i + 0.5) / GRID) / size;
      const y = (py + (j + 0.5) / GRID) / size;
      const colour = SHAPES.findLast(([, inside]) => inside(x, y))?.[0] ?? NIGHT;
      for (let c = 0; c < 3; c++) sum[c] += colour[c];
    }
  }
  return sum.map((total) => Math.round(total / GRID ** 2));
}

/** An opaque RGB PNG of the icon, size pixels square. */
export function iconPng(size) {
  // Each row starts with filter type 0 (none).
  const rows = Buffer.alloc(size * (1 + size * 3));
  for (let py = 0; py < size; py++) {
    const row = py * (1 + size * 3);
    for (let px = 0; px < size; px++) rows.set(pixel(size, px, py), row + 1 + px * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits per channel, RGB, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

// The CRC-32 PNG chunks end with (ISO 3309), computed bit by bit.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const size of SIZES) {
    const path = new URL(`../extension/icons/icon-${size}.png`, import.meta.url);
    writeFileSync(path, iconPng(size));
  }
}
