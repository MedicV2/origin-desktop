const { spawn } = require('child_process')
const fs = require('fs')

function findExecutable(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[candidates.length - 1]
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || undefined,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_OPTIONAL_LOCKS: '0',
        LANG: 'en_US.UTF-8',
        ...(opts.env || {}),
      },
      windowsHide: opts.windowsHide !== false,
      shell: false,
      detached: Boolean(opts.detached),
      stdio: opts.stdio || 'pipe',
    })
    if (opts.detached) {
      child.unref()
      resolve({ ok: true, code: 0, stdout: '', stderr: '' })
      return
    }
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => {
      stdout += d.toString('utf8')
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString('utf8')
    })
    const timeout = opts.timeout ?? 120000
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {}
    }, timeout)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, code: -1, stdout, stderr: err.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, code: code ?? 1, stdout, stderr })
    })
  })
}

module.exports = { findExecutable, run }
