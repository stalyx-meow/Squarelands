const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const LIMIT = 32 * 1024 * 1024;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function decode(buffer) {
  if (buffer.length > LIMIT) throw new Error('Update too large / 更新包过大');
  const bundle = JSON.parse(zlib.gunzipSync(buffer, { maxOutputLength: LIMIT }).toString('utf8'));
  if (bundle.format !== 1 || bundle.runtime !== 1 || bundle.saveSchema !== 2 || !/^\d+\.\d+\.\d+$/.test(bundle.version) || !Array.isArray(bundle.files) || bundle.files.length > 1000) throw new Error('Incompatible update / 更新包不兼容');
  const seen = new Set(); let total = 0;
  for (const file of bundle.files) {
    if (typeof file.path !== 'string' || !/^(server|client|shared)\/[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.split('/').some(p => !p || p === '.' || p === '..') || seen.has(file.path) || typeof file.data !== 'string') throw new Error('Invalid update path / 更新包路径无效');
    seen.add(file.path);
    const data = Buffer.from(file.data, 'base64'); total += data.length;
    if (total > LIMIT || hash(data) !== file.sha256) throw new Error('Corrupt update / 更新包校验失败');
    file.bytes = data;
  }
  for (const required of ['server/index.js', 'client/index.html', 'shared/i18n.js']) if (!seen.has(required)) throw new Error('Incomplete update / 更新包不完整');
  return bundle;
}
class CoreUpdates {
  constructor(directory, bundledEntry, bundledVersion) { this.directory = directory; this.bundledEntry = bundledEntry; this.bundledVersion = bundledVersion; this.pointer = path.join(directory, 'active.json'); }
  state() { try { return JSON.parse(fs.readFileSync(this.pointer, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; } }
  entry() { const { active } = this.state(); if (!active) return this.bundledEntry; if (!/^[a-f0-9]{64}$/.test(active)) throw new Error('Invalid active update'); return path.join(this.directory, active, 'server/index.js'); }
  info() { const s = this.state(); return { coreVersion: s.version || this.bundledVersion, canRollback: Boolean(s.active) }; }
  write(state) { fs.mkdirSync(this.directory, { recursive: true }); fs.writeFileSync(`${this.pointer}.tmp`, JSON.stringify(state)); fs.renameSync(`${this.pointer}.tmp`, this.pointer); }
  install(filename) {
    if (fs.statSync(filename).size > LIMIT) throw new Error('Update too large');
    const buffer = fs.readFileSync(filename), bundle = decode(buffer), id = hash(buffer), destination = path.join(this.directory, id), staging = `${destination}.tmp`;
    fs.mkdirSync(this.directory, { recursive: true });
    fs.rmSync(staging, { recursive: true, force: true });
    try {
      fs.mkdirSync(staging);
      for (const file of bundle.files) { const target = path.join(staging, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.bytes, { flag: 'wx' }); }
      fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify({ type: 'module', version: bundle.version }));
      if (!fs.existsSync(destination)) fs.renameSync(staging, destination);
      const previous = this.state();
      if (previous.active === id) return this.info();
      this.write({ active: id, version: bundle.version, previous: previous.active || null, previousVersion: previous.version || this.bundledVersion });
    } finally { fs.rmSync(staging, { recursive: true, force: true }); }
    return this.info();
  }
  rollback() { const s = this.state(); this.write({ active: s.previous || null, version: s.previousVersion || this.bundledVersion }); return this.info(); }
}
module.exports = { CoreUpdates, decode, hash };
