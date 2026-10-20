const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { normalizeAddress, readSettings, writeSettings } = require('./settings.cjs');
app.setName('Squarelands Client');
if (process.env.SQUARELANDS_USER_DATA) app.setPath('userData', process.env.SQUARELANDS_USER_DATA);
let launcher, gameWindow, connecting = false, quitting = false;
const launcherFile = path.join(__dirname, 'ui/client.html');
const settingsFile = () => path.join(app.getPath('userData'), 'connections.json');
const settings = () => readSettings(settingsFile(), { address: process.env.GAME_SERVER_URL || '127.0.0.1:3210', recent: [] });
function trusted(event) {
  if (event.sender !== launcher?.webContents || event.senderFrame.url !== pathToFileURL(launcherFile).href) throw new Error('此操作只允许在连接页面执行');
}
async function connect(value) {
  if (connecting) throw new Error('正在连接，请稍候');
  connecting = true;
  let candidate;
  try {
    const address = normalizeAddress(value);
    let response;
    try { response = await fetch(`${address}/api/health`, { signal: AbortSignal.timeout(7000), redirect: 'error' }); }
    catch { throw new Error('无法连接服务器，请检查地址、端口、网络和服务端运行状态'); }
    let health;
    try { health = await response.json(); } catch {}
    if (!response.ok || health?.service !== 'squarelands' || health.protocol !== 1) throw new Error('该地址不是兼容的方域服务端，请更新服务端后重试');
    candidate = new BrowserWindow({ width: 1500, height: 980, minWidth: 900, minHeight: 700, show: false, backgroundColor: '#101a1f', title: '方域 · Squarelands', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    candidate.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    candidate.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== address) event.preventDefault(); });
    await candidate.loadURL(address);
    const previous = settings();
    const recent = [address, ...(Array.isArray(previous.recent) ? previous.recent : [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
    writeSettings(settingsFile(), { address, recent });
    gameWindow = candidate;
    gameWindow.on('closed', () => { gameWindow = null; if (!quitting) launcher?.show(); });
    launcher.hide(); gameWindow.show(); return { address };
  } catch (error) { candidate?.destroy(); throw error; }
  finally { connecting = false; }
}
async function start() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: '游戏 / Game', submenu: [{ label: '切换服务器 / Switch server', click: () => { gameWindow?.close(); launcher?.show(); } }, { role: 'quit', label: '退出 / Quit' }] },
    { role: 'editMenu', label: '编辑 / Edit' }, { role: 'viewMenu', label: '视图 / View' }
  ]));
  ipcMain.handle('client:settings', event => { trusted(event); return settings(); });
  ipcMain.handle('client:connect', async (event, address) => { trusted(event); try { return { ok: true, ...await connect(address) }; } catch (error) { return { ok: false, error: error.message }; } });
  launcher = new BrowserWindow({ width: 1000, height: 760, minWidth: 760, minHeight: 650, backgroundColor: '#101a1f', title: '方域 · 连接世界', webPreferences: { preload: path.join(__dirname, 'client-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  launcher.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  launcher.webContents.on('will-navigate', event => event.preventDefault());
  launcher.on('close', event => { if (gameWindow && !quitting) { event.preventDefault(); launcher.hide(); } });
  await launcher.loadFile(launcherFile);
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
app.whenReady().then(start).catch(error => { dialog.showErrorBox('客户端启动失败', error.message); app.quit(); });
