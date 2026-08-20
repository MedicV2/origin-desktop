const fs = require('fs')
const path = require('path')

function defaults(documentsPath) {
  return {
    repositories: [],
    selectedPath: null,
    theme: 'paper',
    cloneDir: path.join(documentsPath, 'Origin'),
    skippedSignIn: false,
    editor: 'code',
    gitName: '',
    gitEmail: '',
    defaultBranch: 'main',
  }
}

function load(file, documentsPath) {
  const base = defaults(documentsPath)
  try {
    const raw = fs.readFileSync(file, 'utf8')
    return { ...base, ...JSON.parse(raw) }
  } catch {
    return base
  }
}

function save(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8')
}

module.exports = { defaults, load, save }
