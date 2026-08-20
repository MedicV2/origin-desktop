const KEYWORDS = {
  js: 'async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof var void while with yield enum interface type namespace as satisfies',
  py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
  rust: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil',
  css: 'important from to',
}

function keywordSet(lang) {
  const raw = KEYWORDS[lang] || KEYWORDS.js
  return new Set(raw.split(/\s+/))
}

export function languageFromPath(filePath) {
  const ext = String(filePath || '').split('.').pop().toLowerCase()
  const map = {
    js: 'js', jsx: 'js', mjs: 'js', cjs: 'js', ts: 'js', tsx: 'js',
    json: 'json', py: 'py', css: 'css', scss: 'css', html: 'html', htm: 'html',
    md: 'text', rs: 'rust', go: 'go', gml: 'js', sh: 'sh', bash: 'sh', ps1: 'sh',
    yml: 'json', yaml: 'json', toml: 'json', xml: 'html', svg: 'html',
  }
  return map[ext] || 'text'
}

function push(out, type, text) {
  if (!text) return
  const last = out[out.length - 1]
  if (last && last.type === type) last.text += text
  else out.push({ type, text })
}

export function tokenize(code, lang) {
  const src = String(code || '')
  const keys = keywordSet(lang)
  const out = []
  let i = 0
  const n = src.length

  while (i < n) {
    const two = src.slice(i, i + 2)
    if (lang !== 'json' && two === '//') {
      const end = src.indexOf('\n', i)
      const cut = end === -1 ? n : end
      push(out, 'cmt', src.slice(i, cut))
      i = cut
      continue
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      const cut = end === -1 ? n : end + 2
      push(out, 'cmt', src.slice(i, cut))
      i = cut
      continue
    }
    const ch = src[i]
    if (ch === '"' || ch === "'" || (ch === '`' && lang === 'js')) {
      let j = i + 1
      while (j < n && src[j] !== ch) {
        if (src[j] === '\\') j += 2
        else j += 1
      }
      push(out, 'str', src.slice(i, Math.min(n, j + 1)))
      i = Math.min(n, j + 1)
      continue
    }
    if (ch === '#' && (lang === 'py' || lang === 'sh')) {
      const end = src.indexOf('\n', i)
      const cut = end === -1 ? n : end
      push(out, 'cmt', src.slice(i, cut))
      i = cut
      continue
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1
      while (j < n && /[0-9_.xXa-fA-F]/.test(src[j])) j += 1
      push(out, 'num', src.slice(i, j))
      i = j
      continue
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j += 1
      const word = src.slice(i, j)
      let k = j
      while (k < n && /\s/.test(src[k])) k += 1
      const type = keys.has(word) ? 'kw' : src[k] === '(' ? 'fn' : /^[A-Z]/.test(word) ? 'type' : 'id'
      push(out, type, word)
      i = j
      continue
    }
    push(out, 'punct', ch)
    i += 1
  }
  return out
}
