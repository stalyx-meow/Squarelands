const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { ServerController } = require('./server-controller.cjs');
const { validateServerConfig, readSettings, writeSettings } = require('./settings.cjs');

app.setName('Squarelands Server');
// Separate GUI server saves from the client and the old development server.
app.setPath('userData', process.env.SQUARELANDS_USER_DATA || path.join(app.getPath('appData'), 'Squarelands Server'));
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
let win, controller, quitting = false, stopped = false;
const uiFile = path.join(__dirname, 'ui/server.html');
const configFile = () => path.join(app.getPath('userData'), 'server-config.json');
function trusted(event) {
  if (event.sender !== win?.webContents || event.senderFrame.url !== pathToFileURL(uiFile).href) throw new Error('只允许在服务端控制台执行');
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    trusted(event);
    try { return { ok: true, value: await fn(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
async function start() {
  const defaults = { host: '0.0.0.0', port: 3210, autoStart: true, secureCookie: false };
  let config;
  try { config = validateServerConfig(readSettings(configFile(), defaults)); }
  catch { config = defaults; }
  const dataDir = process.env.DATA_DIR || path.join(app.getPath('userData'), 'world');
  fs.mkdirSync(dataDir, { recursive: true });
  controller = new ServerController({ entry: path.join(__dirname, '../server/index.js'), dataDir, config });
  controller.on('change', () => { if (win && !win.isDestroyed()) win.webContents.send('server:changed', controller.snapshot()); });
  handle('server:state', () => controller.snapshot());
  handle('server:start', async value => {
    const config = validateServerConfig(value); writeSettings(configFile(), config);
    return controller.start(config);
  });
  handle('server:stop', async () => { await controller.stop(); return controller.snapshot(); });
  handle('server:config', value => {
    if (controller.child) throw new Error('请先停止服务端，再修改监听配置');
    const config = validateServerConfig(value); writeSettings(configFile(), config); controller.config = config;
    controller.emit('change'); return controller.snapshot();
  });
  handle('server:copy-address', address => {
    if (!controller.snapshot().addresses.includes(address)) throw new Error('无效的连接地址');
    clipboard.writeText(address);
  });
  handle('server:open-world', async () => {
    if (controller.status !== 'running') throw new Error('请先启动服务端');
    await shell.openExternal(controller.localUrl);
  });
  handle('server:open-data', async () => { const error = await shell.openPath(dataDir); if (error) throw new Error(error); });
  handle('server:backup', async () => {
    if (controller.child) throw new Error('请先停止服务端，再备份存档');
    const result = await dialog.showOpenDialog(win, { title: '选择备份保存目录', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    const destination = path.join(result.filePaths[0], `Squarelands-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    if (path.resolve(destination).startsWith(`${path.resolve(dataDir)}${path.sep}`)) throw new Error('备份目录不能放在世界存档内部');
    fs.cpSync(dataDir, destination, { recursive: true, errorOnExist: true, force: false });
    controller.log(`已备份世界至 ${destination}`); return destination;
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu', label: '文件' }, { role: 'editMenu', label: '编辑' }, { role: 'viewMenu', label: '视图' }
  ]));
  win = new BrowserWindow({ width: 1150, height: 920, minWidth: 850, minHeight: 700, backgroundColor: '#101b20', title: '方域服务端 · 世界控制台', webPreferences: { preload: path.join(__dirname, 'server-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  await win.loadFile(uiFile);
  if (config.autoStart) controller.start().catch(error => controller.log(error.message));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('before-quit', event => {
  if (stopped || !controller?.child) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  controller.stop().finally(() => { stopped = true; app.quit(); });
});
app.on('window-all-closed', () => app.quit());
if (hasLock) app.whenReady().then(start).catch(error => { dialog.showErrorBox('服务端启动失败', error.message); app.quit(); });
