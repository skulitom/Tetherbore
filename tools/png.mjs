// PNG, as little of it as the tools need, with Node's own zlib and nothing else: `encodePNG` writes 8-bit RGBA
// pixels, `decodePNG` reads back an 8-bit RGB or RGBA picture that is not interlaced (what a browser's screenshot
// and `encodePNG` both give) as RGBA.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC = new Uint32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n; });
const crc = bytes => { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'latin1'); data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

// `rgba`: width x height x 4 bytes, rows from the top.
export function encodePNG(width, height, rgba) {
  const header = Buffer.alloc(13), rows = Buffer.alloc((width * 4 + 1) * height);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// { width, height, data }: data is width x height x 4 bytes of RGBA, rows from the top.
export function decodePNG(file) {
  if (file.length < 33 || !file.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  const width = file.readUInt32BE(16), height = file.readUInt32BE(20), depth = file[24], type = file[25], interlace = file[28];
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`a PNG this reader does not read (depth ${depth}, colour type ${type}, interlace ${interlace})`);
  const parts = [];
  for (let at = 8; at + 12 <= file.length;) {
    const length = file.readUInt32BE(at), name = file.toString('latin1', at + 4, at + 8);
    if (name === 'IDAT') parts.push(file.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const n = type === 6 ? 4 : 3, stride = width * n, raw = inflateSync(Buffer.concat(parts)), data = new Uint8Array(width * height * 4), row = new Uint8Array(stride);
  let before = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= n ? row[x - n] : 0, b = before[x], c = x >= n ? before[x - n] : 0;
      let add = 0;
      if (filter === 1) add = a; else if (filter === 2) add = b; else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = (line[x] + add) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = row[x * n]; data[o + 1] = row[x * n + 1]; data[o + 2] = row[x * n + 2]; data[o + 3] = n === 4 ? row[x * n + 3] : 255;
    }
    before.set(row);
  }
  return { width, height, data };
}
