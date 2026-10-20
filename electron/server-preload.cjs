const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('serverApp', {
  installUpdate: () => ipcRenderer.invoke('server:install-update'),
  rollbackUpdate: () => ipcRenderer.invoke('server:rollback-update'),
  state: () => ipcRenderer.invoke('server:state'),
  start: config => ipcRenderer.invoke('server:start', config),
  stop: () => ipcRenderer.invoke('server:stop'),
  saveConfig: config => ipcRenderer.invoke('server:config', config),
  openWorld: () => ipcRenderer.invoke('server:open-world'),
  openData: () => ipcRenderer.invoke('server:open-data'),
  backup: () => ipcRenderer.invoke('server:backup'),
  copyAddress: address => ipcRenderer.invoke('server:copy-address', address),
  onChange: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('server:changed', listener); return () => ipcRenderer.removeListener('server:changed', listener); }
});
