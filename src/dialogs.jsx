import { useEffect, useState } from 'react'
import { Icon, LogoMark } from './icons.jsx'
import { accountHandle, initials, avatarColor, THEMES } from './display.js'
import { AccountAvatar } from './chrome.jsx'

export const GITIGNORES = {
  None: '',
  Node: `node_modules/\ndist/\nbuild/\n.env\n*.log\n.DS_Store\n`,
  Python: `__pycache__/\n.venv/\nvenv/\n*.pyc\n.env\n.pytest_cache/\n`,
  VisualStudio: `.vs/\nbin/\nobj/\n*.user\n*.suo\n`,
  Unity: `Library/\nTemp/\nObj/\nBuild/\nBuilds/\nLogs/\nUserSettings/\n`,
  Java: `target/\n*.class\n.idea/\n*.iml\n`,
  Go: `bin/\nvendor/\n*.exe\n`,
  Rust: `/target/\nCargo.lock\n`,
  C: `*.o\n*.obj\n*.exe\n*.out\n`,
}

export const MIT = `MIT License

Copyright (c) ${new Date().getFullYear()}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`

export function Modal({ title, children, footer, onClose, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>{title}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function Welcome({ busy, onSignIn, onSkip }) {
  return (
    <div className="welcome">
      <LogoMark size={84} />
      <h1>Let’s get started</h1>
      <p className="lede">Sign in with your Cursor account to clone, commit, and open pull requests on Origin.</p>
      <div className="actions">
        <button className="btn block" onClick={onSignIn} disabled={busy === 'login'}>
          {busy === 'login' ? 'Waiting for browser…' : 'Sign in to Cursor Origin'}
        </button>
        <button className="btn link" onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  )
}

export function Blank({ auth, accountName, onCreate, onAdd, onClone, onSignIn }) {
  const handle = accountHandle(accountName)
  return (
    <div className="welcome">
      <LogoMark size={72} />
      {auth?.signedIn && (
        <div className="signed-pill">
          <AccountAvatar url={auth.avatar} name={accountName} size={22} />
          Signed in as {handle}
        </div>
      )}
      <h1>{auth?.signedIn ? `Welcome back, ${handle}` : 'Origin Desktop'}</h1>
      <p className="lede">Create something new, add a folder you already have, or clone a Cursor Origin repo.</p>
      <div className="start-grid">
        <button className="start-card" onClick={onCreate}>
          <span className="well"><Icon name="plus" size={18} /></span>
          <div>
            <h4>Create a new repository</h4>
            <p>Initialize a local Git repo and optionally publish it to Origin.</p>
          </div>
          <span className="shortcut"><kbd>Ctrl</kbd><kbd>N</kbd></span>
        </button>
        <button className="start-card" onClick={onAdd}>
          <span className="well"><Icon name="folder" size={18} /></span>
          <div>
            <h4>Add an existing repository</h4>
            <p>Open a Git folder already on this computer.</p>
          </div>
          <span className="shortcut"><kbd>Ctrl</kbd><kbd>O</kbd></span>
        </button>
        <button className="start-card" onClick={onClone}>
          <span className="well"><Icon name="desktop" size={18} /></span>
          <div>
            <h4>Clone from Cursor Origin</h4>
            <p>Bring down a repository from origin.cursor.com.</p>
          </div>
          <span className="shortcut"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>O</kbd></span>
        </button>
      </div>
      {!auth?.signedIn && (
        <button className="btn" style={{ marginTop: 18 }} onClick={onSignIn}>Sign in to Cursor Origin</button>
      )}
    </div>
  )
}

export function CloneDialog({ store, originRepos, error, busy, onClose, onClone }) {
  const [tab, setTab] = useState('origin')
  const [q, setQ] = useState('')
  const [url, setUrl] = useState('')
  const [directory, setDirectory] = useState(store.cloneDir)
  const [picked, setPicked] = useState(null)
  const filtered = originRepos.filter((r) => !q || r.fullName.toLowerCase().includes(q.toLowerCase()))
  const can = tab === 'url' ? Boolean(url.trim()) : Boolean(picked)
  return (
    <Modal
      title="Clone a repository"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            disabled={!can || busy === 'clone'}
            onClick={() => {
              if (tab === 'url') {
                const m = url.trim().match(/origin\.cursor\.com(?:\/git)?\/([^/]+)\/([^/.]+)/i)
                onClone(m ? `${m[1]}/${m[2]}` : 'repo', directory, url.trim())
              } else onClone(picked.fullName, directory)
            }}
          >
            {busy === 'clone' ? 'Cloning…' : 'Clone'}
          </button>
        </>
      }
    >
      <div className="clone-layout">
        <div className="clone-tabs">
          <button className={`clone-tab ${tab === 'origin' ? 'active' : ''}`} onClick={() => setTab('origin')}>Cursor Origin</button>
          <button className={`clone-tab ${tab === 'url' ? 'active' : ''}`} onClick={() => setTab('url')}>URL</button>
        </div>
        <div className="clone-main">
          {tab === 'origin' && (
            <>
              <div className="filter-row">
                <div className="filter-wrap">
                  <Icon name="search" className="search-ic" />
                  <input placeholder="Filter Cursor Origin repositories" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
              <div className="file-list" style={{ maxHeight: 260 }}>
                {filtered.map((r) => (
                  <div key={r.fullName} className={`repo-row ${picked?.fullName === r.fullName ? 'selected' : ''}`} onClick={() => setPicked(r)}>
                    <Icon name="repo" />
                    <div className="commit-meta">
                      <div className="subject">{r.name}</div>
                      <div className="kicker">{r.fullName}</div>
                    </div>
                  </div>
                ))}
                {!filtered.length && <div className="empty"><p>No Cursor Origin repositories match. Sign in, or paste a clone URL instead.</p></div>}
              </div>
            </>
          )}
          {tab === 'url' && (
            <div className="form-row">
              <label>Repository URL</label>
              <input className="field" placeholder="https://origin.cursor.com/owner/repo.git" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>Local path</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" value={directory} onChange={(e) => setDirectory(e.target.value)} />
          <button className="btn secondary" onClick={async () => {
            const dir = await window.od.dialog('openDirectory', { title: 'Choose clone location', defaultPath: directory })
            if (dir) setDirectory(dir)
          }}>Choose…</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function AddDialog({ error, onClose, onAdd }) {
  return (
    <Modal title="Add local repository" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" onClick={onAdd}>Choose…</button></>}>
      <p className="muted">Choose a folder that already contains a Git repository.</p>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function CreateDialog({ store, auth, busy, error, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [base, setBase] = useState(store.cloneDir)
  const [readme, setReadme] = useState(true)
  const [gitignore, setGitignore] = useState('None')
  const [license, setLicense] = useState('None')
  const [publish, setPublish] = useState(Boolean(auth?.signedIn))
  return (
    <Modal
      title="Create a new repository"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!name.trim() || busy === 'create'} onClick={() => onCreate({ name: name.trim(), description, base, readme, gitignore, license, publish })}>
            {busy === 'create' ? 'Creating…' : 'Create repository'}
          </button>
        </>
      }
    >
      <div className="form-row"><label>Name</label><input className="field" value={name} onChange={(e) => setName(e.target.value.replace(/\s+/g, '-'))} autoFocus /></div>
      <div className="form-row"><label>Description</label><input className="field" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="form-row">
        <label>Local path</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" value={base} onChange={(e) => setBase(e.target.value)} />
          <button className="btn secondary" onClick={async () => {
            const dir = await window.od.dialog('openDirectory', { defaultPath: base })
            if (dir) setBase(dir)
          }}>Choose…</button>
        </div>
        {name && <div className="hint">{base}\{name}</div>}
      </div>
      <label className="checkbox-row"><input type="checkbox" className="check" checked={readme} onChange={(e) => setReadme(e.target.checked)} /> Initialize this repository with a README</label>
      <div className="form-row">
        <label>Git ignore</label>
        <select className="select" value={gitignore} onChange={(e) => setGitignore(e.target.value)}>
          {Object.keys(GITIGNORES).map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>License</label>
        <select className="select" value={license} onChange={(e) => setLicense(e.target.value)}>
          <option>None</option>
          <option>MIT</option>
        </select>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" className="check" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={!auth?.signedIn} />
        Publish this repository to Origin
      </label>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function PublishDialog({ status, busy, error, onClose, onPublish }) {
  const [name, setName] = useState(status.name || '')
  return (
    <Modal title="Publish repository" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={!name.trim() || busy === 'publish'} onClick={() => onPublish(name.trim())}>{busy === 'publish' ? 'Publishing…' : 'Publish repository'}</button></>}>
      <p className="muted">This will create a repository on Origin and push <strong>{status.branch.name}</strong>.</p>
      <div className="form-row"><label>Name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function BranchDialog({ status, busy, error, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState(status.branch.name)
  return (
    <Modal title="Create a branch" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={!name.trim() || busy === 'branch'} onClick={() => onCreate(name.trim(), start)}>{busy === 'branch' ? 'Creating…' : 'Create branch'}</button></>}>
      <div className="form-row"><label>Name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="form-row">
        <label>Create branch from</label>
        <select className="select" value={start} onChange={(e) => setStart(e.target.value)}>
          {status.branches.local.map((b) => <option key={b.name}>{b.name}</option>)}
        </select>
      </div>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function PromptDialog({ title, label, value, confirm, danger, busy, error, onClose, onConfirm }) {
  const [v, setV] = useState(value)
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className={`btn ${danger ? 'danger' : ''}`} disabled={!v.trim() || busy} onClick={() => onConfirm(v.trim())}>{busy ? 'Working…' : confirm}</button></>}>
      <div className="form-row"><label>{label}</label><input className="field" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></div>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function MergeDialog({ type, status, busy, error, onClose, onGo }) {
  const [branch, setBranch] = useState(status.defaultBranch)
  const names = status.branches.local.map((b) => b.name).filter((n) => n !== status.branch.name)
  return (
    <Modal title={type === 'rebase' ? 'Rebase current branch' : 'Merge into current branch'} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={!branch || busy} onClick={() => onGo(branch)}>{busy ? 'Working…' : type === 'rebase' ? 'Rebase' : 'Merge'}</button></>}>
      <p className="muted">{type === 'rebase' ? `Rebase ${status.branch.name} onto the selected branch.` : `Merge the selected branch into ${status.branch.name}.`}</p>
      <div className="form-row">
        <label>Branch</label>
        <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)}>
          {names.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function PRDialog({ status, summary, busy, error, onClose, onCreate }) {
  const [title, setTitle] = useState(summary || status.branch.name.replace(/[-_]/g, ' '))
  const [body, setBody] = useState('')
  const [base, setBase] = useState(status.defaultBranch)
  const [draft, setDraft] = useState(false)
  return (
    <Modal title="Create a pull request" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={!title.trim() || busy === 'pr' || !status.isOrigin} onClick={() => onCreate({ title, body, base, draft })}>{busy === 'pr' ? 'Creating…' : 'Create pull request'}</button></>}>
      {!status.isOrigin && <div className="error">This repository is not on Origin. Publish it first.</div>}
      <div className="form-row"><label>Title</label><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-row"><label>Description</label><textarea className="field" style={{ height: 90, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="form-row">
        <label>Base branch</label>
        <select className="select" value={base} onChange={(e) => setBase(e.target.value)}>
          {status.branches.local.map((b) => <option key={b.name}>{b.name}</option>)}
        </select>
      </div>
      <label className="checkbox-row"><input type="checkbox" className="check" checked={draft} onChange={(e) => setDraft(e.target.checked)} /> Create as draft</label>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}

export function PrefsDialog({ store, auth, onClose, onSave, onApply, onSignIn, onSignOut }) {
  const [theme, setTheme] = useState(store.theme === 'light' ? 'paper' : store.theme === 'dark' ? 'midnight' : store.theme)
  const [cloneDir, setCloneDir] = useState(store.cloneDir)
  const [gitName, setGitName] = useState(store.gitName)
  const [gitEmail, setGitEmail] = useState(store.gitEmail)
  const [editor, setEditor] = useState(store.editor)
  return (
    <Modal title="Options" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" onClick={() => onSave({ theme, cloneDir, gitName, gitEmail, editor })}>Save</button></>}>
      <div className="form-row">
        <label>Cursor Origin account</label>
        {auth?.signedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AccountAvatar url={auth.avatar} name={auth.account} size={36} />
              <span>{auth.account}</span>
            </div>
            <button className="btn secondary small" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <button className="btn small" onClick={onSignIn}>Sign in to Cursor Origin</button>
        )}
      </div>
      <div className="form-row">
        <label>Theme</label>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-card ${theme === t.id ? 'selected' : ''}`}
              onClick={() => { setTheme(t.id); (onApply || onSave)({ theme: t.id }) }}
            >
              <span className="theme-swatch">
                <span style={{ background: t.swatch[0] }} />
                <span style={{ background: t.swatch[1] }} />
              </span>
              <small>{t.label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>Clone path</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" value={cloneDir} onChange={(e) => setCloneDir(e.target.value)} />
          <button className="btn secondary" onClick={async () => {
            const dir = await window.od.dialog('openDirectory', { defaultPath: cloneDir })
            if (dir) setCloneDir(dir)
          }}>Choose…</button>
        </div>
      </div>
      <div className="form-row"><label>Git name</label><input className="field" value={gitName} onChange={(e) => setGitName(e.target.value)} /></div>
      <div className="form-row"><label>Git email</label><input className="field" value={gitEmail} onChange={(e) => setGitEmail(e.target.value)} /></div>
      <div className="form-row"><label>External editor command</label><input className="field" value={editor} onChange={(e) => setEditor(e.target.value)} /></div>
    </Modal>
  )
}

export function AboutDialog({ onClose }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    window.od.appInfo().then(setInfo)
  }, [])
  return (
    <Modal title="About Origin Desktop" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="about-row">
        <LogoMark size={64} />
        <div>
          <h3 style={{ margin: 0 }}>Origin Desktop</h3>
          <p className="muted">Desktop Git client for Cursor Origin.</p>
          <p className="muted">Version {info?.version || '1.0.0'}</p>
        </div>
      </div>
    </Modal>
  )
}
