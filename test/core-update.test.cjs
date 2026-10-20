const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { CoreUpdates, hash } = require('../electron/core-update.cjs');
function bundle(version = '1.2.1', extra = []) {
  return zlib.gzipSync(JSON.stringify({ format: 1, runtime: 1, saveSchema: 2, version, files: ['server/index.js','client/index.html','shared/i18n.js'].map(name => ({ path: name, data: Buffer.from('test').toString('base64'), sha256: hash(Buffer.from('test')) })).concat(extra) }));
}
test('install, restart and roll back code without changing saves; reject corrupt paths atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'squarelands-update-'));
  try {
    const updater = new CoreUpdates(path.join(dir,'updates'), '/bundled/server/index.js', '1.2.1');
    const save = path.join(dir,'world.db'); fs.writeFileSync(save,'precious save');
    const archive = path.join(dir,'update.gz'); fs.writeFileSync(archive,bundle()); updater.install(archive);
    assert.equal(updater.info().coreVersion,'1.2.1'); assert.equal(fs.readFileSync(updater.entry(),'utf8'),'test');
    assert.equal(new CoreUpdates(updater.directory,updater.bundledEntry,'1.2.1').entry(),updater.entry());
    const before = updater.entry();
    for (const malicious of [{ path:'server/../../world.db',data:'',sha256:hash(Buffer.alloc(0)) },{ path:'client/bad.js',data:'eA==',sha256:'bad' }]) {
      fs.writeFileSync(archive,bundle('1.2.2',[malicious])); assert.throws(() => updater.install(archive)); assert.equal(updater.entry(),before);
    }
    fs.writeFileSync(archive,bundle('1.2.2')); updater.install(archive); updater.rollback(); assert.equal(updater.info().coreVersion,'1.2.1');
    updater.rollback(); assert.equal(updater.entry(),updater.bundledEntry);
    assert.equal(fs.readFileSync(save,'utf8'),'precious save');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('real universal bundle starts from external code and preserves login across restart', async t => {
  const { execFileSync } = require('node:child_process');
  const { createServer } = require('node:net');
  const { once } = require('node:events');
  const { ServerController } = require('../electron/server-controller.cjs');
  const version = JSON.parse(fs.readFileSync(path.resolve('package.json'),'utf8')).version;
  execFileSync(process.execPath,['scripts/package-update.mjs']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'squarelands-live-update-'));
  const socket = createServer(); socket.listen(0,'127.0.0.1'); await once(socket,'listening'); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const updates = new CoreUpdates(path.join(dir,'updates'),path.resolve('server/index.js'),'1.2.1');
  updates.install(path.resolve(`dist/update/Squarelands-Update-${version}.squarelands-update.gz`));
  const dataDir = path.join(dir,'world'); fs.mkdirSync(dataDir);
  const controller = new ServerController({entry:updates.entry(),dataDir,config:{host:'127.0.0.1',port}});
  t.after(async()=> { await controller.stop(); fs.rmSync(dir,{recursive:true,force:true}); });
  let state = await controller.start(); const password = state.initialPassword;
  assert.equal((await (await fetch(state.localUrl+'/api/health')).json()).version,version);
  assert.match(await (await fetch(state.localUrl+'/client/inventory.js')).text(),/warehouseHTML/);
  await controller.stop(); controller.password = null; state = await controller.start();
  const login = await fetch(state.localUrl+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'root',password})}); assert.equal(login.status,200);
});
