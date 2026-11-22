// What the desktop shell puts in the page, and all it puts there: `window.tetherboreDesktop`. (The window is sandboxed,
// so this file can require only electron, and the channels are written out here rather than taken from steam.cjs.)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tetherboreDesktop', {
  achievements: {
    sync: ids => ipcRenderer.invoke('tetherbore:achievements-sync', ids),
    unlock: id => ipcRenderer.invoke('tetherbore:achievements-unlock', id),
  },
});
