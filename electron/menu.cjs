const { Menu, shell } = require('electron')

function buildMenu(send) {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          { label: 'New Repository…', accelerator: 'CmdOrCtrl+N', click: () => send('new-repo') },
          { label: 'Add Local Repository…', accelerator: 'CmdOrCtrl+O', click: () => send('add-repo') },
          { label: 'Clone Repository…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('clone-repo') },
          { type: 'separator' },
          { label: 'Options…', accelerator: 'CmdOrCtrl+,', click: () => send('options') },
          { type: 'separator' },
          { role: 'quit', label: 'Exit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { label: 'Changes', accelerator: 'CmdOrCtrl+1', click: () => send('tab-changes') },
          { label: 'History', accelerator: 'CmdOrCtrl+2', click: () => send('tab-history') },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Repository',
        submenu: [
          { label: 'Push', accelerator: 'CmdOrCtrl+P', click: () => send('push') },
          { label: 'Pull', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('pull') },
          { label: 'Fetch', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('fetch') },
          { type: 'separator' },
          { label: 'Remove…', click: () => send('remove-repo') },
          { label: 'View on Origin', click: () => send('view-on-origin') },
          { type: 'separator' },
          { label: 'Open in Command Prompt', click: () => send('open-shell') },
          { label: 'Show in Explorer', click: () => send('open-explorer') },
          { label: 'Open in External Editor', click: () => send('open-editor') },
          { type: 'separator' },
          { label: 'Create Pull Request', click: () => send('create-pr') },
        ],
      },
      {
        label: 'Branch',
        submenu: [
          { label: 'New Branch…', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('new-branch') },
          { label: 'Rename…', click: () => send('rename-branch') },
          { label: 'Delete…', click: () => send('delete-branch') },
          { type: 'separator' },
          { label: 'Update from Default Branch', click: () => send('update-from-default') },
          { label: 'Merge into Current Branch…', click: () => send('merge') },
          { label: 'Rebase Current Branch…', click: () => send('rebase') },
          { label: 'Compare on Origin', click: () => send('compare-on-origin') },
          { type: 'separator' },
          { label: 'Stash All Changes…', click: () => send('stash') },
        ],
      },
      {
        label: 'Help',
        submenu: [
          { label: 'Welcome', click: () => send('welcome') },
          { label: 'Cursor Origin Docs', click: () => shell.openExternal('https://cursor.com/docs/origin') },
          { type: 'separator' },
          { label: 'About Origin Desktop', click: () => send('about') },
        ],
      },
    ])
  )
}

module.exports = { buildMenu }
