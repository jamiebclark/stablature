/**
 * Generates the app icons.
 *
 * Written by hand rather than pulled from a design tool because the icon is
 * five horizontal lines -- a tab staff -- and that is both the right mark for
 * this app and trivial to rasterise pixel by pixel. No image dependency, and
 * the icon is reproducible from source.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BACKGROUND = [0x0b, 0x0b, 0x0d];
const STRING = [0x3d, 0x3d, 0x49];
const ACCENT = [0xff, 0xa6, 0x29];

/** Five strings, like the bass the app is for. */
const STRINGS = 5;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * `alpha` writes RGBA rather than RGB.
 *
 * Needed for the favicon: Next decodes app/favicon.ico at build time and its
 * ICO reader rejects an embedded PNG that is not RGBA, with "The PNG is not in
 * RGBA format!". The standalone PNGs do not need it, but there is no cost to
 * one code path.
 */
function encodePng(width, height, pixels, alpha = false) {
  const channels = alpha ? 4 : 3;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // colour type: truecolour, with or without alpha
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // One filter byte per scanline, filter type 0 (none).
  const raw = Buffer.alloc(height * (1 + width * channels));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixels(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      if (alpha) raw[offset + 3] = 255;
      offset += channels;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * The mark: five strings with two notes on them.
 *
 * `padding` is the safe-area inset. Maskable icons get cropped to a circle on
 * Android, so that variant draws the staff smaller to survive it.
 */
function staff(size, padding) {
  const inset = Math.round(size * padding);
  const usable = size - inset * 2;
  const gap = usable / (STRINGS - 1);
  const lineThickness = Math.max(1, Math.round(size * 0.016));
  const noteSize = Math.max(2, Math.round(size * 0.1));

  // Two notes, on the lowest and middle strings: a riff, not a chord.
  const notes = [
    { string: 4, x: 0.3 },
    { string: 2, x: 0.62 },
  ];

  return (x, y) => {
    for (const note of notes) {
      const cx = inset + usable * note.x;
      const cy = inset + gap * note.string;
      if (Math.abs(x - cx) <= noteSize / 2 && Math.abs(y - cy) <= noteSize / 2) {
        return ACCENT;
      }
    }

    for (let index = 0; index < STRINGS; index += 1) {
      const lineY = inset + gap * index;
      if (Math.abs(y - lineY) <= lineThickness / 2 && x >= inset && x <= size - inset) {
        return STRING;
      }
    }

    return BACKGROUND;
  };
}

mkdirSync("public/icons", { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, padding: 0.18 },
  { file: "icon-512.png", size: 512, padding: 0.18 },
  // Maskable icons are cropped to a circle, so the mark needs more room.
  { file: "icon-maskable-512.png", size: 512, padding: 0.28 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.18 },
];

for (const target of targets) {
  const png = encodePng(target.size, target.size, staff(target.size, target.padding));
  writeFileSync(`public/icons/${target.file}`, png);
  console.log(`public/icons/${target.file}  ${target.size}x${target.size}  ${png.length} bytes`);
}

/**
 * A simplified mark for tiny sizes.
 *
 * The full five-string staff with two notes turns to mush at 16px, so the
 * favicon drops to three strings and one note. Same idea, fewer things
 * fighting for the same twelve usable pixels.
 */
function smallStaff(size) {
  const inset = Math.round(size * 0.14);
  const usable = size - inset * 2;
  const gap = usable / 2;
  const thickness = Math.max(1, Math.round(size * 0.07));
  const note = Math.max(3, Math.round(size * 0.3));
  const cx = inset + usable * 0.52;
  const cy = inset + gap;

  return (x, y) => {
    if (Math.abs(x - cx) <= note / 2 && Math.abs(y - cy) <= note / 2) return ACCENT;
    for (let i = 0; i < 3; i += 1) {
      const lineY = inset + gap * i;
      if (Math.abs(y - lineY) <= thickness / 2 && x >= inset && x <= size - inset) return STRING;
    }
    return BACKGROUND;
  };
}

/** Wrap PNGs in an ICO container. Browsers accept PNG-in-ICO. */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

// The browser-tab icon. Next serves app/favicon.ico at /favicon.ico and
// injects the link itself, which is why this has to live there rather than in
// public/ -- and why the scaffold's default one shipped unnoticed for a while.
const icoSizes = [16, 32, 48];
const ico = encodeIco(
  icoSizes.map((size) => ({
    size,
    png: encodePng(size, size, size <= 32 ? smallStaff(size) : staff(size, 0.14), true),
  })),
);
writeFileSync("src/app/favicon.ico", ico);
console.log(`src/app/favicon.ico  ${icoSizes.join("/")}  ${ico.length} bytes`);
