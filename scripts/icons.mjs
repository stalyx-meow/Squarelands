import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
mkdirSync('build/icons', { recursive: true });
function crc32(data) { let crc = -1; for (const byte of data) { crc ^= byte; for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
function chunk(name, data) { const type = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([size, type, data, crc]); }
function png(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = Math.floor(x * 32 / size), py = Math.floor(y * 32 / size);
    let color = [18, 34, 39, 255];
    if (px >= 3 && px <= 28 && py >= 3 && py <= 28) color = [210, 185, 118, 255];
    if (px >= 5 && px <= 26 && py >= 5 && py <= 26) color = [36, 63, 56, 255];
    if (px >= 8 && px <= 23 && py >= 10 && py <= 24) color = [192, 178, 136, 255];
    if (px >= 11 && px <= 20 && py >= 8 && py <= 11) color = [122, 150, 115, 255];
    if ((px >= 7 && px <= 10 || px >= 21 && px <= 24) && py >= 7 && py <= 24) color = [220, 204, 155, 255];
    if (px >= 14 && px <= 17 && py >= 19 && py <= 24) color = [36, 63, 56, 255];
    if ((px === 12 || px === 19) && py >= 13 && py <= 15) color = [54, 83, 78, 255];
    if (px === 16 && py >= 4 && py <= 8 || px >= 17 && px <= 21 && py >= 4 && py <= 5) color = [236, 198, 111, 255];
    const i = y * (size * 4 + 1) + 1 + x * 4; rows.set(color, i);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const large = png(1024), medium = png(512), small = png(256);
writeFileSync('build/icons/icon.png', medium);
const iconHeader = Buffer.alloc(22); iconHeader.writeUInt16LE(1, 2); iconHeader.writeUInt16LE(1, 4); iconHeader.writeUInt16LE(1, 10); iconHeader.writeUInt16LE(32, 12); iconHeader.writeUInt32LE(small.length, 14); iconHeader.writeUInt32LE(22, 18);
writeFileSync('build/icons/icon.ico', Buffer.concat([iconHeader, small]));
const icnsChunk = (type, image) => { const size = Buffer.alloc(4); size.writeUInt32BE(image.length + 8); return Buffer.concat([Buffer.from(type), size, image]); };
const images = Buffer.concat([icnsChunk('ic09', medium), icnsChunk('ic10', large)]), icnsSize = Buffer.alloc(4); icnsSize.writeUInt32BE(images.length + 8);
writeFileSync('build/icons/icon.icns', Buffer.concat([Buffer.from('icns'), icnsSize, images]));
