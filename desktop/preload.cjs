// What the desktop shell puts in the page, and all it puts there: `window.tetherboreDesktop`. (The window is sandboxed,
// so this file can require only electron, and the channels are written out here rather than taken from steam.cjs.)
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
  achievements: {
    sync: ids => ipcRenderer.invoke('tetherbore:achievements-sync', ids),
    unlock: id => ipcRenderer.invoke('tetherbore:achievements-unlock', id),
  },
});
