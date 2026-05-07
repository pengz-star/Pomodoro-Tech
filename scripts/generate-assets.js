const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeB, data, crc]);
}

function createCirclePNG(size, r, g, b) {
  const rawRow = (row) => {
    const pixels = [];
    for (let x = 0; x < size; x++) {
      const cx = x - (size - 1) / 2;
      const cy = row - (size - 1) / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const inside = dist <= size / 2 - 1;
      pixels.push(inside ? r : 0);
      pixels.push(inside ? g : 0);
      pixels.push(inside ? b : 0);
      pixels.push(inside ? 255 : 0);
    }
    return Buffer.from([0, ...pixels]); // filter byte + RGBA
  };

  const rawData = Buffer.concat(Array.from({ length: size }, (_, y) => rawRow(y)));
  const compressed = zlib.deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  ihdr[9] = 6;  // 8-bit RGBA

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createBellWAV() {
  const sampleRate = 8000;
  const duration = 0.4;
  const freq = 880;
  const numSamples = Math.floor(sampleRate * duration);

  const dataSize = numSamples;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const samples = Buffer.alloc(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / duration);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
    samples.writeUInt8(Math.round(128 + sample * 60), i);
  }

  return Buffer.concat([header, samples]);
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), createCirclePNG(32, 136, 136, 136));
fs.writeFileSync(path.join(ASSETS_DIR, 'icon-focus.png'), createCirclePNG(32, 231, 76, 60));
fs.writeFileSync(path.join(ASSETS_DIR, 'icon-break.png'), createCirclePNG(32, 39, 174, 96));
fs.writeFileSync(path.join(ASSETS_DIR, 'bell.wav'), createBellWAV());
console.log('Assets generated in', ASSETS_DIR);
