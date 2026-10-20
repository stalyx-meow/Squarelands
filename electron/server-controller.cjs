const { EventEmitter } = require('node:events');
const { fork } = require('node:child_process');
const os = require('node:os');
const { validateServerConfig } = require('./settings.cjs');

class ServerController extends EventEmitter {
  constructor({ entry, dataDir, config, spawn = fork }) {
    super(); this.entry = entry; this.dataDir = dataDir; this.config = validateServerConfig(config);
    this.spawn = spawn; this.status = 'stopped'; this.logs = []; this.child = null; this.localUrl = null; this.password = null;
  }
  log(message) {
    const text = `[${new Date().toLocaleTimeString('zh-CN')}] ${String(message).trim()}`;
    this.logs.push(text); if (this.logs.length > 300) this.logs.shift(); this.emit('change');
  }
  snapshot() {
    const { host, port } = this.config;
    const addresses = this.status !== 'running' ? [] : [this.localUrl];
    if (this.status === 'running' && ['0.0.0.0', '::'].includes(host)) {
      for (const rows of Object.values(os.networkInterfaces())) for (const row of rows || []) {
        if (!row.internal && row.family === 'IPv4') addresses.push(`http://${row.address}:${port}`);
      }
    }
    return { status: this.status, config: this.config, dataDir: this.dataDir, logs: this.logs,
      localUrl: this.localUrl, addresses: [...new Set(addresses)], initialPassword: this.password };
  }
  async start(config = this.config) {
    if (this.child || this.status === 'starting') throw new Error('服务端已在运行或正在启动');
    this.config = validateServerConfig(config); this.status = 'starting'; this.localUrl = null; this.emit('change');
    this.log(`正在启动世界，监听 ${this.config.host}:${this.config.port}`);
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', HOST: this.config.host, PORT: String(this.config.port), DATA_DIR: this.dataDir, COOKIE_SECURE: this.config.secureCookie ? '1' : '0' };
    delete env.ROOT_PASSWORD; // GUI bootstrap credentials are generated in the server and never saved to config.
    let child;
    // app.asar is a virtual filesystem and cannot be used as the OS working directory.
    try { child = this.spawn(this.entry, [], { env, cwd: this.dataDir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }); }
    catch (error) { this.status = 'error'; this.log(error.message); throw error; }
    this.child = child;
    child.stdout?.on('data', data => this.log(data)); child.stderr?.on('data', data => this.log(data));
    child.on('message', message => {
      if (message.type === 'bootstrap') { this.password = message.password; this.emit('change'); }
    });
    return new Promise((resolve, reject) => {
      let ready = false;
      const timeout = setTimeout(() => { this.log('服务端启动超时'); child.kill(); reject(new Error('启动超时，请查看运行日志')); }, 15000);
      child.on('message', message => {
        if (message.type !== 'ready') return;
        ready = true; clearTimeout(timeout); this.status = 'running';
        this.localUrl = `http://${['::', '::1'].includes(this.config.host) ? '[::1]' : '127.0.0.1'}:${this.config.port}`;
        this.emit('change'); resolve(this.snapshot());
      });
      child.once('error', error => { clearTimeout(timeout); this.child = null; this.status = 'error'; this.log(error.message); reject(error); });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout); const stopping = this.status === 'stopping';
        this.child = null; this.status = stopping || code === 0 ? 'stopped' : 'error'; this.localUrl = null;
        this.log(stopping ? '服务端已安全停止，存档已保存' : `服务端已退出（${code ?? signal}）`);
        if (!ready) reject(new Error('服务端未能启动，请检查端口是否被占用，并查看日志'));
      });
    });
  }
  async stop() {
    const child = this.child; if (!child) return;
    this.status = 'stopping'; this.emit('change');
    await new Promise(resolve => {
      const timeout = setTimeout(() => { this.log('安全停止超时，正在终止进程；请检查最新存档'); child.kill(); }, 10000);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
      if (child.connected) child.send({ type: 'shutdown' }, error => { if (error) child.kill(); });
      else child.kill();
    });
  }
}
module.exports = { ServerController };
