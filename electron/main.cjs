const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const storeFile = require('./store.cjs')
const git = require('./git.cjs')
const origin = require('./origin.cjs')
const { buildMenu } = require('./menu.cjs')
const { run } = require('./spawn.cjs')

app.setName('Origin Desktop')
app.setAppUserModelId('com.origin.desktop')

const isDev = !app.isPackaged && process.argv.includes('--dev')
const ORIGIN_WEB = 'https://cursor.com/codebase'
const TITLEBAR_H = 56
const CHROME = {
  paper: { bg: '#f7f5f2', toolbar: '#f3f0eb', ink: '#1c1917' },
  light: { bg: '#f7f5f2', toolbar: '#f3f0eb', ink: '#1c1917' },
  midnight: { bg: '#141210', toolbar: '#1a1715', ink: '#f5f0eb' },
  dark: { bg: '#141210', toolbar: '#1a1715', ink: '#f5f0eb' },
  cursor: { bg: '#0a0a0a', toolbar: '#111111', ink: '#f4f4f5' },
  ocean: { bg: '#0b1220', toolbar: '#082f49', ink: '#e0f2fe' },
  forest: { bg: '#102116', toolbar: '#14532d', ink: '#e8f0ea' },
  ember: { bg: '#1c1012', toolbar: '#4c0519', ink: '#ffe4e6' },
  slate: { bg: '#22272e', toolbar: '#2d333b', ink: '#e6edf3' },
  contrast: { bg: '#22272e', toolbar: '#2d333b', ink: '#e6edf3' },
}

let mainWindow = null
let state = null
let overlayDim = false

function chromeOf(theme) {
  return CHROME[theme] || CHROME.paper
}

function mixBlack(hex, amount) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const keep = 1 - Math.min(1, Math.max(0, amount))
  const r = Math.round(((n >> 16) & 255) * keep)
  const g = Math.round(((n >> 8) & 255) * keep)
  const b = Math.round((n & 255) * keep)
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

function applyChrome(theme = state?.theme) {
  const c = chromeOf(theme)
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setBackgroundColor(c.bg)
  const dim = overlayDim ? (['paper', 'light'].includes(theme) ? 0.42 : 0.58) : 0
  try {
    mainWindow.setTitleBarOverlay({
      color: dim ? mixBlack(c.toolbar, dim) : c.toolbar,
      symbolColor: dim ? mixBlack(c.ink, dim * 0.35) : c.ink,
      height: TITLEBAR_H,
    })
  } catch {}
}

function statePath() {
  return path.join(app.getPath('userData'), 'state.json')
}

function loadState() {
  state = storeFile.load(statePath(), app.getPath('documents'))
  return state
}

function saveState() {
  storeFile.save(statePath(), state)
}

function crashLog(message) {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {}
}

function createWindow() {
  const icon = path.join(__dirname, '..', 'assets', 'icon.png')
  const chrome = chromeOf(state.theme)
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: chrome.bg,
    show: false,
    icon: fs.existsSync(icon) ? icon : undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: chrome.toolbar,
      symbolColor: chrome.ink,
      height: TITLEBAR_H,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  function placeOnPrimary() {
    const area = screen.getPrimaryDisplay().workArea
    const width = Math.min(1280, area.width)
    const height = Math.min(800, area.height)
    mainWindow.setBounds({
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height,
    })
  }
  mainWindow.once('ready-to-show', () => {
    placeOnPrimary()
    try { mainWindow.setOpacity(0) } catch {}
    mainWindow.show()
    placeOnPrimary()
    let opacity = 0
    const fade = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      opacity = Math.min(1, opacity + 0.08)
      try { mainWindow.setOpacity(opacity) } catch {}
      if (opacity < 1) setTimeout(fade, 16)
    }
    fade()
  })
  if (isDev) mainWindow.loadURL('http://127.0.0.1:5173')
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => crashLog(`render-process-gone ${JSON.stringify(details)}`))
}

process.on('uncaughtException', (err) => crashLog(`uncaughtException ${err.stack || err}`))
process.on('unhandledRejection', (err) => crashLog(`unhandledRejection ${err && err.stack ? err.stack : err}`))

app.whenReady().then(() => {
  loadState()
  nativeTheme.themeSource = state.theme === 'system' ? 'system' : (['paper', 'light'].includes(state.theme) ? 'light' : 'dark')
  buildMenu((id) => mainWindow?.webContents.send('menu', id))
  createWindow()
})

app.on('window-all-closed', () => app.quit())

ipcMain.handle('chrome', (_e, dim) => {
  overlayDim = Boolean(dim)
  applyChrome(state.theme)
  return { ok: true }
})
ipcMain.handle('store:get', () => loadState())
ipcMain.handle('store:set', (_e, next) => {
  state = { ...state, ...next }
  saveState()
  if (next.theme) {
    nativeTheme.themeSource = next.theme === 'system' ? 'system' : (['paper', 'light'].includes(next.theme) ? 'light' : 'dark')
    applyChrome(next.theme)
  }
  return state
})
ipcMain.handle('git', (_e, action, payload) => git.dispatch(action, payload, state))
ipcMain.handle('origin', (_e, action, payload) => origin.dispatch(action, payload))
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  name: 'Origin Desktop',
  git: git.GIT,
  origin: origin.ORIGIN,
  userData: app.getPath('userData'),
}))
ipcMain.handle('dialog', async (_e, action, payload = {}) => {
  if (action === 'openDirectory') {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: payload.title || 'Choose a folder',
      defaultPath: payload.defaultPath || state.cloneDir,
      properties: ['openDirectory', 'createDirectory'],
    })
    return r.canceled ? null : r.filePaths[0]
  }
  if (action === 'confirm') {
    const r = await dialog.showMessageBox(mainWindow, {
      type: payload.type || 'question',
      buttons: payload.buttons || ['Cancel', 'OK'],
      defaultId: payload.defaultId ?? 1,
      cancelId: 0,
      title: payload.title || 'Origin Desktop',
      message: payload.message || '',
      detail: payload.detail || '',
      noLink: true,
    })
    return r.response
  }
  return null
})
ipcMain.handle('shell', async (_e, action, payload = {}) => {
  if (action === 'openExternal') return shell.openExternal(payload.url)
  if (action === 'openPath') return shell.openPath(payload.path)
  if (action === 'openEditor') {
    const r = await run(state.editor || 'code', [payload.path], { timeout: 10000 })
    if (!r.ok) return run('cmd', ['/c', 'start', '', payload.path])
    return r
  }
  if (action === 'openShell') {
    spawn('cmd.exe', ['/k', `cd /d "${payload.path}"`], {
      detached: true,
      stdio: 'ignore',
      cwd: payload.path,
      windowsHide: false,
    }).unref()
    return { ok: true }
  }
  if (action === 'webRepo') return shell.openExternal(`${ORIGIN_WEB}/${payload.fullName}`)
  if (action === 'webCompare') return shell.openExternal(`${ORIGIN_WEB}/${payload.fullName}/compare/${payload.branch}`)
  return { ok: false }
})
