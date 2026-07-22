#!/usr/bin/env node
// Deterministic, dependency-free placeholder app icon.
// A solid eye-searing magenta square so an unbranded app LOOKS unfinished on the
// home screen instead of looking done with the stock Expo icon. new-project.sh
// stamps this over the template art; scripts/check-shell.sh fails while it (or the
// Expo default) is still the icon — see that file's REJECT_HASHES.
//
//   node scripts/make-placeholder-icon.js <out.png> [size]
const fs = require('fs');
const zlib = require('zlib');

const [out, sizeArg] = process.argv.slice(2);
if (!out) { console.error('usage: make-placeholder-icon.js <out.png> [size]'); process.exit(1); }
const size = Number(sizeArg) || 1024;
const [R, G, B] = [0xff, 0x2d, 0x9b]; // hot magenta — reads as "REPLACE ME"

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0, 0);
  return Buffer.concat([len, td, crc]);
}
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return ~c;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA

// raw scanlines: 1 filter byte (0) + size*4 RGBA per row
const row = Buffer.alloc(1 + size * 4);
for (let x = 0; x < size; x++) { const o = 1 + x * 4; row[o] = R; row[o + 1] = G; row[o + 2] = B; row[o + 3] = 0xff; }
const raw = Buffer.concat(Array.from({ length: size }, () => row));
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(out, png);
console.log(`  wrote ${out} (${size}x${size} placeholder)`);
