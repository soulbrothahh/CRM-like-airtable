// Generates NuKava PWA icons (no external deps) using zlib for PNG encoding.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../public/icons", import.meta.url), { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // raw with filter byte per row
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function makeIcon(size, { rounded = true } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  // gradient colors (kava-400 -> kava-700)
  const top = [255, 157, 60];
  const bot = [194, 74, 12];
  const radius = rounded ? size * 0.22 : 0;

  // N geometry
  const pad = size * 0.26;
  const bar = size * 0.12; // bar thickness
  const x0 = pad;
  const x1 = size - pad;
  const y0 = pad;
  const y1 = size - pad;

  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const bg = [lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t)];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // rounded-corner alpha
      let inside = true;
      if (rounded) {
        const cx = Math.min(x, size - 1 - x);
        const cy = Math.min(y, size - 1 - y);
        if (cx < radius && cy < radius) {
          const dx = radius - cx;
          const dy = radius - cy;
          if (dx * dx + dy * dy > radius * radius) inside = false;
        }
      }

      if (!inside) {
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
        continue;
      }

      // is this pixel part of the "N"?
      let isN = false;
      if (y >= y0 && y <= y1) {
        // left bar
        if (x >= x0 && x <= x0 + bar) isN = true;
        // right bar
        if (x >= x1 - bar && x <= x1) isN = true;
        // diagonal
        const dc = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
        if (Math.abs(x - dc) <= bar * 0.62) isN = true;
      }

      if (isN) {
        buf[i] = 255;
        buf[i + 1] = 251;
        buf[i + 2] = 245;
        buf[i + 3] = 255;
      } else {
        buf[i] = bg[0];
        buf[i + 1] = bg[1];
        buf[i + 2] = bg[2];
        buf[i + 3] = 255;
      }
    }
  }
  return encodePng(size, buf);
}

const targets = [
  ["public/icons/icon-192.png", 192, true],
  ["public/icons/icon-512.png", 512, true],
  ["public/icons/apple-touch-icon.png", 180, false],
];

for (const [path, size, rounded] of targets) {
  const png = makeIcon(size, { rounded });
  writeFileSync(new URL("../" + path, import.meta.url), png);
  console.log("wrote", path, png.length, "bytes");
}
