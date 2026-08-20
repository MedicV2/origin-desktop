const crypto = require('crypto')
const https = require('https')
const { git } = require('./git.cjs')

function md5(text) {
  return crypto.createHash('md5').update(String(text).trim().toLowerCase()).digest('hex')
}

function gravatarUrl(email) {
  return `https://www.gravatar.com/avatar/${md5(email)}?s=128&d=404`
}

function githubAvatarUrl(email) {
  const numeric = String(email || '').match(/^(\d+)\+.+@users\.noreply\.github\.com$/i)
  if (numeric) return `https://avatars.githubusercontent.com/u/${numeric[1]}?s=128&v=4`
  const named = String(email || '').match(/^(.+)@users\.noreply\.github\.com$/i)
  if (named) return `https://github.com/${named[1]}.png?size=128`
  return null
}

function get(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'OriginDesktop' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        get(res.headers.location).then(resolve)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        resolve(null)
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (buf.length < 32) return resolve(null)
        resolve({ mime: (res.headers['content-type'] || 'image/jpeg').split(';')[0], buf })
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(8000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

async function avatarCandidates(accountEmail) {
  const urls = []
  if (accountEmail) urls.push(gravatarUrl(accountEmail))
  const cfg = await git(['config', '--global', 'user.email'])
  const gitEmail = cfg.ok ? cfg.stdout.trim() : ''
  const gh = githubAvatarUrl(gitEmail) || githubAvatarUrl(accountEmail)
  if (gh) urls.push(gh)
  return [...new Set(urls)]
}

async function avatarDataUrl(accountEmail) {
  for (const url of await avatarCandidates(accountEmail)) {
    const got = await get(url)
    if (got) return `data:${got.mime};base64,${got.buf.toString('base64')}`
  }
  return null
}

module.exports = { avatarDataUrl }
