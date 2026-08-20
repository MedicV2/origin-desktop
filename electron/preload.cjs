const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('od', {
  git: (action, payload) => ipcRenderer.invoke('git', action, payload),
  origin: (action, payload) => ipcRenderer.invoke('origin', action, payload),
  store: {
    get: () => ipcRenderer.invoke('store:get'),
    set: (state) => ipcRenderer.invoke('store:set', state),
  },
  dialog: (action, payload) => ipcRenderer.invoke('dialog', action, payload),
  shell: (action, payload) => ipcRenderer.invoke('shell', action, payload),
  appInfo: () => ipcRenderer.invoke('app:info'),
  chrome: (dim) => ipcRenderer.invoke('chrome', dim),
  onMenu: (handler) => {
    const listener = (_event, id, extra) => handler(id, extra)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  },
})
