import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { decode, hash } = require('../electron/core-update.cjs');
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const files = [];
function collect(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = `${directory}/${item.name}`;
    if (item.isSymbolicLink()) throw new Error(`Symlink forbidden: ${name}`);
    if (item.isDirectory()) collect(name);
    else { const data = fs.readFileSync(name); files.push({ path: name, sha256: hash(data), data: data.toString('base64') }); }
  }
}
for (const directory of ['server', 'client', 'shared']) collect(directory);
const buffer = zlib.gzipSync(JSON.stringify({ format: 1, runtime: 1, saveSchema: 2, version, files }), { level: 9 });
decode(buffer);
fs.mkdirSync('dist/update', { recursive: true });
const filename = `Squarelands-Update-${version}.squarelands-update.gz`;
fs.writeFileSync(path.join('dist/update', filename), buffer);
fs.writeFileSync('dist/update/SHA256SUMS.txt', `${hash(buffer)}  ${filename}\n`);
console.log(`${filename}: ${(buffer.length / 1024).toFixed(1)} KiB; Windows / Linux / macOS`);
