const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 128, H = 128;
const buf = Buffer.alloc(W * H * 4);

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const sa = a / 255;
  buf[i]     = Math.round(r * sa + buf[i]     * (1 - sa));
  buf[i + 1] = Math.round(g * sa + buf[i + 1] * (1 - sa));
  buf[i + 2] = Math.round(b * sa + buf[i + 2] * (1 - sa));
  buf[i + 3] = Math.max(buf[i + 3], a);
}

function roundRect(x0, y0, x1, y1, rad, r, g, b) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let dx = 0, dy = 0;
      if (x < x0 + rad) dx = x0 + rad - x;
      else if (x > x1 - 1 - rad) dx = x - (x1 - 1 - rad);
      if (y < y0 + rad) dy = y0 + rad - y;
      else if (y > y1 - 1 - rad) dy = y - (y1 - 1 - rad);
      if (dx * dx + dy * dy <= rad * rad) setPx(x, y, r, g, b, 255);
    }
  }
}

function disc(cx, cy, rad, r, g, b) {
  for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
    for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= rad * rad) setPx(x, y, r, g, b, 255);
    }
  }
}

roundRect(0, 0, W, H, 26, 0x6c, 0x5c, 0xe7);
disc(64, 82, 24, 255, 255, 255);
disc(40, 50, 11, 255, 255, 255);
disc(55, 38, 11, 255, 255, 255);
disc(73, 38, 11, 255, 255, 255);
disc(88, 50, 11, 255, 255, 255);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "icon.png");
fs.writeFileSync(out, png);
console.log("wrote", out, png.length, "bytes");
