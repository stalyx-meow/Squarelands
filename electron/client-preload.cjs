const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('squarelands', {
  settings: () => ipcRenderer.invoke('client:settings'),
  connect: address => ipcRenderer.invoke('client:connect', address)
});
