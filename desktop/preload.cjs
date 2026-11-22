// What the page may ask of the desktop shell, and nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tetherboreDesktop', {
  saves: {
    read: () => ipcRenderer.invoke('saves:read'),
    write: data => ipcRenderer.invoke('saves:write', data),
  },
  window: {
    isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    quit: () => ipcRenderer.invoke('window:quit'),
    onFullscreen: listen => ipcRenderer.on('window:fullscreen', (_, on) => listen(on)),
    onFlush: flush => ipcRenderer.on('window:flush', async () => {
      try { await flush(); } finally { ipcRenderer.send('window:flushed'); }
    }),
  },
});
