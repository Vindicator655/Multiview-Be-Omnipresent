'use strict';
// Generates extension/icons/icon{16,32,48,128}.png - a 2x2 video wall with one "live" tile.
// No dependencies: draws with 4x supersampling and writes PNGs by hand.
// Run from the repo root: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => { let c = ~0; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, sum]);
}
function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inTriangle(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const pt = [x, y], d1 = s(pt, [ax, ay], [bx, by]), d2 = s(pt, [bx, by], [cx, cy]), d3 = s(pt, [cx, cy], [ax, ay]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// Shapes in unit coordinates, painted in order (later wins).
function shapes(size) {
  const m = 0.17, g = 0.07, t = (1 - 2 * m - g) / 2, r = 0.06;
  const tile = (col, row) => [m + col * (t + g), m + row * (t + g), m + col * (t + g) + t, m + row * (t + g) + t];
  const list = [
    { color: hex('#10151c'), hit: (x, y) => inRoundRect(x, y, 0, 0, 1, 1, 0.22) },
    { color: hex('#ff4d4f'), hit: (x, y) => inRoundRect(x, y, ...tile(0, 0), r) },
    { color: hex('#3fb6ff'), hit: (x, y) => inRoundRect(x, y, ...tile(1, 0), r) },
    { color: hex('#3fb6ff'), hit: (x, y) => inRoundRect(x, y, ...tile(0, 1), r) },
    { color: hex('#2b8fd6'), hit: (x, y) => inRoundRect(x, y, ...tile(1, 1), r) }
  ];
  if (size >= 32) { // play glyph on the live tile; too small to read at 16px
    const [x0, y0, x1, y1] = tile(0, 0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = t * 0.22;
    list.push({ color: hex('#ffffff'), hit: (x, y) => inTriangle(x, y, [cx - s * 0.8, cy - s], [cx - s * 0.8, cy + s], [cx + s, cy]) });
  }
  return list;
}

function render(size) {
  const ss = 4, list = shapes(size), out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size, y = (py + (sy + 0.5) / ss) / size;
          let c = null;
          for (const s of list) if (s.hit(x, y)) c = s.color;
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      }
      const o = (py * size + px) * 4;
      if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round((a / (ss * ss)) * 255);
    }
  }
  return out;
}

const dir = path.join(__dirname, '..', 'extension', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = path.join(dir, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(size, render(size)));
  console.log('wrote', path.relative(process.cwd(), file));
}
