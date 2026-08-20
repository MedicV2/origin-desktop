import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './icons.jsx'
import { syncAction, resolveTheme } from './display.js'
import { Toolbar, RepoPopover, BranchPopover, BootSplash } from './chrome.jsx'
import { Workspace } from './workspace.jsx'
import {
  GITIGNORES,
  MIT,
  Welcome,
  Blank,
  CloneDialog,
  AddDialog,
  CreateDialog,
  PublishDialog,
  BranchDialog,
  PromptDialog,
  MergeDialog,
  PRDialog,
  PrefsDialog,
  AboutDialog,
} from './dialogs.jsx'

export default function App() {
  const [ready, setReady] = useState(false)
  const [boot, setBoot] = useState('in')
  const [store, setStore] = useState(null)
  const bootAt = useRef(Date.now())
  const [auth, setAuth] = useState(null)
  const [screen, setScreen] = useState('loading')
  const [status, setStatus] = useState(null)
  const [tab, setTab] = useState('changes')
  const [fileFilter, setFileFilter] = useState('')
  const [repoFilter, setRepoFilter] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [diff, setDiff] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [popover, setPopover] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [commits, setCommits] = useState([])
  const [selectedCommit, setSelectedCommit] = useState(null)
  const [commitFiles, setCommitFiles] = useState([])
  const [prs, setPrs] = useState([])
  const [originRepos, setOriginRepos] = useState([])
  const [sidebarW, setSidebarW] = useState(350)
  const [checked, setChecked] = useState({})
  const drag = useRef(null)
  const toastTimer = useRef(null)
  const loginTimer = useRef(null)
  const ops = useRef({})

  const selectedPath = store?.selectedPath
  const repos = store?.repositories || []
  const currentRepo = repos.find((r) => r.path === selectedPath) || null
  const accountName = auth?.account || store?.gitName || 'You'
  const theme = resolveTheme(store?.theme, window.matchMedia('(prefers-color-scheme: dark)').matches)

  const persist = useCallback(async (patch) => {
    const next = await window.od.store.set(patch)
    setStore(next)
    return next
  }, [])

  const flash = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }, [])

  const refreshStatus = useCallback(async (repoPath = selectedPath) => {
    if (!repoPath) {
      setStatus(null)
      return null
    }
    const st = await window.od.git('status', { path: repoPath })
    setStatus(st)
    setChecked((prev) => {
      const next = { ...prev }
      for (const f of st.files || []) {
        if (next[f.path] === undefined) next[f.path] = true
      }
      return next
    })
    return st
  }, [selectedPath])

  const refreshHistory = useCallback(async (repoPath = selectedPath) => {
    if (!repoPath) return
    const r = await window.od.git('log', { path: repoPath, limit: 120 })
    setCommits(r.commits || [])
  }, [selectedPath])

  const refreshPrs = useCallback(async (st) => {
    if (!st?.isOrigin || !st.fullName) {
      setPrs([])
      return
    }
    const r = await window.od.origin('prList', { repo: st.fullName, state: 'open' })
    setPrs(r.pullRequests || [])
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    window.od.chrome(Boolean(dialog))
  }, [dialog])

  useEffect(() => {
    if (!ready) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wait = Math.max(0, (reduced ? 180 : 1180) - (Date.now() - bootAt.current))
    const t = setTimeout(() => setBoot('out'), wait)
    return () => clearTimeout(t)
  }, [ready])

  useEffect(() => {
    if (boot !== 'out') return
    const t = setTimeout(() => setBoot('off'), 520)
    return () => clearTimeout(t)
  }, [boot])

  useEffect(() => {
    ;(async () => {
      const s = await window.od.store.get()
      setStore(s)
      const a = await window.od.origin('authStatus')
      setAuth(a)
      if (!a.signedIn && !s.skippedSignIn) setScreen('welcome')
      else if (!s.repositories.length) setScreen('blank')
      else setScreen('app')
      setReady(true)
      if (a.signedIn) {
        const profile = await window.od.origin('profile')
        if (profile?.avatar) setAuth((prev) => ({ ...prev, ...profile }))
      }
    })()
    return () => {
      clearTimeout(toastTimer.current)
      clearInterval(loginTimer.current)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'app' || !selectedPath) return
    refreshStatus()
    refreshHistory()
  }, [screen, selectedPath, refreshStatus, refreshHistory])

  useEffect(() => {
    if (status?.isOrigin) refreshPrs(status)
  }, [status?.fullName, status?.isOrigin, refreshPrs])

  useEffect(() => {
    if (tab !== 'changes') return
    const files = status?.files || []
    if (!files.length) {
      setSelectedFile((cur) => (cur ? null : cur))
      return
    }
    setSelectedFile((cur) => (cur && files.some((f) => f.path === cur) ? cur : files[0].path))
  }, [status, tab])

  useEffect(() => {
    if (!selectedPath || !selectedFile || tab !== 'changes') {
      if (tab === 'changes' && !selectedFile) setDiff('')
      return
    }
    const file = status?.files?.find((f) => f.path === selectedFile)
    window.od.git('diff', {
      path: selectedPath,
      file: selectedFile,
      staged: file ? file.staged && !file.unstaged : false,
    }).then((r) => setDiff(r.diff || ''))
  }, [selectedFile, selectedPath, tab, status])

  useEffect(() => {
    if (screen !== 'app' || !selectedPath) return
    const tick = () => {
      if (document.hasFocus()) refreshStatus()
    }
    const t = setInterval(tick, 4000)
    return () => clearInterval(t)
  }, [screen, selectedPath, refreshStatus])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPopover(null)
        setDialog(null)
        setError('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  ops.current = {
    async openClone() {
      setDialog({ type: 'clone' })
      const r = await window.od.origin('repoList')
      setOriginRepos(r.repos || [])
      if (!r.ok) setError(r.error || 'Could not list Origin repositories. Are you signed in?')
    },
    async signIn() {
      setBusy('login')
      await window.od.origin('authLogin')
      flash('Complete sign-in in your browser…')
      const start = Date.now()
      clearInterval(loginTimer.current)
      loginTimer.current = setInterval(async () => {
        const a = await window.od.origin('authStatus')
        setAuth(a)
        if (a.signedIn) {
          clearInterval(loginTimer.current)
          setBusy('')
          setScreen(repos.length ? 'app' : 'blank')
          flash(`Signed in as ${a.account}`)
        } else if (Date.now() - start > 180000) {
          clearInterval(loginTimer.current)
          setBusy('')
        }
      }, 1500)
    },
    async addRepoPath(dir) {
      if (!dir) return
      const check = await window.od.git('isRepo', { path: dir })
      if (!check.ok) {
        setError('That folder is not a Git repository.')
        return
      }
      const ident = await window.od.git('identity', { path: dir })
      const entry = { path: dir, name: ident.name, owner: ident.owner, fullName: ident.fullName, isOrigin: ident.isOrigin }
      await persist({ repositories: [...repos.filter((r) => r.path !== dir), entry], selectedPath: dir })
      setScreen('app')
      setDialog(null)
      setError('')
    },
    async doFetch() {
      if (!selectedPath) return
      setBusy('fetch')
      const r = await window.od.git('fetch', { path: selectedPath })
      setBusy('')
      flash(r.ok ? 'Fetch complete' : r.error || 'Fetch failed')
      await refreshStatus()
    },
    async doPull() {
      if (!selectedPath) return
      setBusy('pull')
      const r = await window.od.git('pull', { path: selectedPath })
      setBusy('')
      flash(r.ok ? 'Pull complete' : r.error || 'Pull failed')
      await refreshStatus()
      await refreshHistory()
    },
    async doPush(force = false) {
      if (!selectedPath || !status) return
      if (!status.upstream) return ops.current.publishBranch()
      setBusy('push')
      const r = await window.od.git('push', { path: selectedPath, branch: status.branch.name, force })
      setBusy('')
      flash(r.ok ? (force ? 'Force pushed' : 'Pushed to Origin') : r.error || 'Push failed')
      await refreshStatus()
    },
    async publishBranch() {
      if (!selectedPath || !status) return
      setBusy('publish')
      const r = await window.od.git('publish', { path: selectedPath, branch: status.branch.name })
      setBusy('')
      flash(r.ok ? `Published ${status.branch.name}` : r.error || 'Publish failed')
      await refreshStatus()
    },
    async updateFromDefault() {
      if (!selectedPath || !status) return
      setBusy('update')
      await window.od.git('fetch', { path: selectedPath })
      const r = await window.od.git('merge', { path: selectedPath, branch: `origin/${status.defaultBranch}` })
      setBusy('')
      flash(r.ok ? `Updated from ${status.defaultBranch}` : r.error || 'Update failed')
      await refreshStatus()
      await refreshHistory()
    },
    async doStash() {
      if (!selectedPath) return
      const r = await window.od.git('stash', { path: selectedPath, message: summary || 'Stashed changes' })
      flash(r.ok ? 'Stashed changes' : r.error || 'Stash failed')
      await refreshStatus()
    },
    async commit() {
      if (!selectedPath || !status) return
      const files = (status.files || []).filter((f) => checked[f.path] !== false).map((f) => f.path)
      if (!summary.trim() || !files.length) return
      setBusy('commit')
      const r = await window.od.git('commit', {
        path: selectedPath,
        files,
        allFiles: (status.files || []).map((f) => f.path),
        summary: summary.trim(),
        description,
      })
      setBusy('')
      if (!r.ok) {
        flash(r.error || 'Commit failed')
        return
      }
      setSummary('')
      setDescription('')
      setSelectedFile(null)
      flash('Committed')
      await refreshStatus()
      await refreshHistory()
    },
    async removeRepo() {
      if (!currentRepo) return
      const next = repos.filter((r) => r.path !== currentRepo.path)
      await persist({ repositories: next, selectedPath: next[0]?.path || null })
      if (!next.length) setScreen('blank')
    },
    viewOnOrigin() {
      if (status?.fullName) window.od.shell('webRepo', { fullName: status.fullName })
    },
    compareOnOrigin() {
      if (status?.fullName && status.branch?.name) window.od.shell('webCompare', { fullName: status.fullName, branch: status.branch.name })
    },
  }

  useEffect(() => {
    return window.od.onMenu((id) => {
      const o = ops.current
      const map = {
        'new-repo': () => setDialog({ type: 'create' }),
        'add-repo': () => setDialog({ type: 'add' }),
        'clone-repo': () => o.openClone(),
        options: () => setDialog({ type: 'prefs' }),
        'tab-changes': () => setTab('changes'),
        'tab-history': () => setTab('history'),
        push: () => o.doPush(),
        pull: () => o.doPull(),
        fetch: () => o.doFetch(),
        'remove-repo': () => o.removeRepo(),
        'view-on-origin': () => o.viewOnOrigin(),
        'open-shell': () => selectedPath && window.od.shell('openShell', { path: selectedPath }),
        'open-explorer': () => selectedPath && window.od.shell('openPath', { path: selectedPath }),
        'open-editor': () => selectedPath && window.od.shell('openEditor', { path: selectedPath }),
        'create-pr': () => setDialog({ type: 'pr' }),
        'new-branch': () => setDialog({ type: 'branch' }),
        'rename-branch': () => setDialog({ type: 'rename' }),
        'delete-branch': () => setDialog({ type: 'delete-branch' }),
        'update-from-default': () => o.updateFromDefault(),
        merge: () => setDialog({ type: 'merge' }),
        rebase: () => setDialog({ type: 'rebase' }),
        'compare-on-origin': () => o.compareOnOrigin(),
        stash: () => o.doStash(),
        welcome: () => setScreen(auth?.signedIn ? 'blank' : 'welcome'),
        about: () => setDialog({ type: 'about' }),
      }
      map[id]?.()
    })
  }, [selectedPath, auth])

  function onSidebarDown(e) {
    drag.current = { startX: e.clientX, startW: sidebarW }
    const move = (ev) => {
      if (!drag.current) return
      setSidebarW(Math.min(520, Math.max(240, drag.current.startW + (ev.clientX - drag.current.startX))))
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function onFetchClick() {
    const id = syncAction(status).id
    if (id === 'publish-repo') setDialog({ type: 'publish' })
    else if (id === 'publish') ops.current.publishBranch()
    else if (id === 'pull') ops.current.doPull()
    else if (id === 'push') ops.current.doPush(false)
    else ops.current.doFetch()
  }

  if (!ready || !store) {
    return (
      <div className="app">
        <BootSplash />
      </div>
    )
  }

  return (
    <div
      className={`app ${boot === 'in' ? 'booting' : boot === 'out' ? 'revealing' : ''}`}
      style={screen === 'app' && currentRepo ? { '--sidebar-w': `${sidebarW}px` } : undefined}
      onClick={() => popover && setPopover(null)}
    >
      <Toolbar
        currentRepo={currentRepo}
        status={status}
        prs={prs}
        popover={popover}
        busy={busy}
        accountName={accountName}
        avatarUrl={auth?.avatar}
        onRepo={() => setPopover(popover === 'repo' ? null : 'repo')}
        onBranch={() => currentRepo && setPopover(popover === 'branch' ? null : 'branch')}
        onFetch={onFetchClick}
        onAccount={() => setDialog({ type: 'prefs' })}
      />

      {popover === 'repo' && (
        <RepoPopover
          repos={repos}
          selectedPath={selectedPath}
          query={repoFilter}
          onQuery={setRepoFilter}
          onSelect={(r) => {
            persist({ selectedPath: r.path })
            setPopover(null)
            setScreen('app')
            setSelectedFile(null)
          }}
          onCreate={() => { setPopover(null); setDialog({ type: 'create' }) }}
          onAdd={() => { setPopover(null); setDialog({ type: 'add' }) }}
          onClone={() => { setPopover(null); ops.current.openClone() }}
        />
      )}

      {popover === 'branch' && status && (
        <BranchPopover
          status={status}
          prs={prs}
          onClose={() => setPopover(null)}
          onNew={() => { setPopover(null); setDialog({ type: 'branch' }) }}
          onCheckout={async (name) => {
            const r = await window.od.git('checkout', { path: selectedPath, branch: name.replace(/^origin\//, '') })
            if (!r.ok) flash(r.error || 'Could not switch branch')
            setPopover(null)
            await refreshStatus()
          }}
          onCheckoutPr={async (pr) => {
            const r = await window.od.origin('prCheckout', { path: selectedPath, repo: status.fullName, number: pr.number })
            if (!r.ok) flash(r.error || 'Could not check out pull request')
            setPopover(null)
            await refreshStatus()
          }}
        />
      )}

      {screen === 'welcome' && (
        <Welcome
          busy={busy}
          onSignIn={() => ops.current.signIn()}
          onSkip={() => {
            persist({ skippedSignIn: true })
            setScreen(repos.length ? 'app' : 'blank')
          }}
        />
      )}

      {screen === 'blank' && (
        <Blank
          auth={auth}
          accountName={accountName}
          onCreate={() => setDialog({ type: 'create' })}
          onAdd={() => setDialog({ type: 'add' })}
          onClone={() => ops.current.openClone()}
          onSignIn={() => setScreen('welcome')}
        />
      )}

      {screen === 'app' && currentRepo && (
        <Workspace
          sidebarW={sidebarW}
          onResize={onSidebarDown}
          tab={tab}
          onTab={(next) => {
            setTab(next)
            if (next === 'history') {
              setSelectedFile(null)
              setDiff('')
              refreshHistory()
            }
          }}
          status={status}
          fileFilter={fileFilter}
          onFileFilter={setFileFilter}
          checked={checked}
          onChecked={setChecked}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          summary={summary}
          onSummary={setSummary}
          description={description}
          onDescription={setDescription}
          onCommit={() => ops.current.commit()}
          busy={busy}
          commits={commits}
          selectedCommit={selectedCommit}
          onSelectCommit={async (c) => {
            setSelectedCommit(c.sha)
            const filesR = await window.od.git('commitFiles', { path: selectedPath, sha: c.sha })
            const list = filesR.files || []
            setCommitFiles(list)
            const first = list[0]?.path || null
            setSelectedFile(first)
            const d = first
              ? await window.od.git('show', { path: selectedPath, sha: c.sha, file: first })
              : await window.od.git('show', { path: selectedPath, sha: c.sha })
            setDiff(d.diff || '')
          }}
          commitFiles={commitFiles}
          onSelectCommitFile={async (path) => {
            setSelectedFile(path)
            const d = await window.od.git('show', { path: selectedPath, sha: selectedCommit, file: path })
            setDiff(d.diff || '')
          }}
          diff={diff}
          onDiscard={async () => {
            const r = await window.od.dialog('confirm', {
              title: 'Discard changes',
              message: `Discard local changes to "${selectedFile}"?`,
              detail: 'This cannot be undone.',
              buttons: ['Cancel', 'Discard'],
            })
            if (r === 1) {
              await window.od.git('discard', { path: selectedPath, file: selectedFile })
              setSelectedFile(null)
              await refreshStatus()
            }
          }}
        />
      )}

      {screen === 'app' && !currentRepo && (
        <div className="empty">
          <h3>No repository selected</h3>
          <p>Choose a repository from the dropdown, or clone one from Origin.</p>
        </div>
      )}

      {dialog?.type === 'clone' && (
        <CloneDialog
          store={store}
          originRepos={originRepos}
          error={error}
          busy={busy}
          onClose={() => { setDialog(null); setError('') }}
          onClone={async (fullName, dest, url) => {
            setBusy('clone')
            setError('')
            const folder = dest.endsWith(fullName.split('/')[1]) ? dest : `${dest.replace(/[\\/]$/, '')}\\${fullName.split('/')[1] || 'repo'}`
            const r = url
              ? await window.od.git('clone', { url, directory: folder })
              : await window.od.origin('repoClone', { repo: fullName, directory: folder })
            setBusy('')
            if (!r.ok) {
              setError(r.error || 'Clone failed')
              return
            }
            await ops.current.addRepoPath(r.path || folder)
            flash(`Cloned ${fullName}`)
          }}
        />
      )}
      {dialog?.type === 'add' && (
        <AddDialog error={error} onClose={() => { setDialog(null); setError('') }} onAdd={async () => {
          const dir = await window.od.dialog('openDirectory', { title: 'Add local repository' })
          if (dir) await ops.current.addRepoPath(dir)
        }} />
      )}
      {dialog?.type === 'create' && (
        <CreateDialog
          store={store}
          auth={auth}
          busy={busy}
          error={error}
          onClose={() => { setDialog(null); setError('') }}
          onCreate={async (form) => {
            setBusy('create')
            setError('')
            const dest = `${form.base.replace(/[\\/]$/, '')}\\${form.name}`
            const r = await window.od.git('init', {
              directory: dest,
              name: form.name,
              description: form.description,
              readme: form.readme,
              gitignore: GITIGNORES[form.gitignore] || '',
              license: form.license === 'MIT' ? MIT : '',
              branch: store.defaultBranch || 'main',
            })
            if (!r.ok) {
              setBusy('')
              setError('Could not create the repository.')
              return
            }
            if (form.publish && auth?.signedIn) {
              const created = await window.od.origin('repoCreate', { repo: form.name, defaultBranch: store.defaultBranch || 'main' })
              if (created.ok) {
                await window.od.git('addRemote', { path: dest, url: created.cloneUrl })
                await window.od.git('push', { path: dest, setUpstream: true, branch: store.defaultBranch || 'main' })
              } else flash(created.error || 'Created locally, but publishing to Origin failed')
            }
            setBusy('')
            await ops.current.addRepoPath(dest)
            flash(`Created ${form.name}`)
          }}
        />
      )}
      {dialog?.type === 'publish' && status && (
        <PublishDialog status={status} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onPublish={async (name) => {
          setBusy('publish')
          const created = await window.od.origin('repoCreate', { repo: name, defaultBranch: status.defaultBranch || 'main' })
          if (!created.ok) {
            setBusy('')
            setError(created.error || 'Could not create Origin repository')
            return
          }
          const existing = status.remotes?.find((r) => r.name === 'origin')
          if (existing) await window.od.git('setRemote', { path: selectedPath, url: created.cloneUrl })
          else await window.od.git('addRemote', { path: selectedPath, url: created.cloneUrl })
          const push = await window.od.git('publish', { path: selectedPath, branch: status.branch.name })
          setBusy('')
          if (!push.ok) setError(push.error || 'Push failed')
          else {
            setDialog(null)
            flash('Published to Origin')
            await refreshStatus()
          }
        }} />
      )}
      {dialog?.type === 'branch' && status && (
        <BranchDialog status={status} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onCreate={async (name, start) => {
          setBusy('branch')
          const r = await window.od.git('createBranch', { path: selectedPath, name, startPoint: start })
          setBusy('')
          if (!r.ok) setError(r.error || 'Could not create branch')
          else {
            setDialog(null)
            await refreshStatus()
          }
        }} />
      )}
      {dialog?.type === 'rename' && status && (
        <PromptDialog title="Rename branch" label="New name" value={status.branch.name} confirm="Rename" busy={busy === 'rename'} error={error} onClose={() => { setDialog(null); setError('') }} onConfirm={async (to) => {
          setBusy('rename')
          const r = await window.od.git('renameBranch', { path: selectedPath, from: status.branch.name, to })
          setBusy('')
          if (!r.ok) setError(r.error)
          else {
            setDialog(null)
            await refreshStatus()
          }
        }} />
      )}
      {dialog?.type === 'delete-branch' && status && (
        <PromptDialog title="Delete branch" label="Branch to delete" value={status.branch.name} confirm="Delete" danger busy={busy === 'delete'} error={error} onClose={() => { setDialog(null); setError('') }} onConfirm={async (name) => {
          setBusy('delete')
          const r = await window.od.git('deleteBranch', { path: selectedPath, name, force: true })
          setBusy('')
          if (!r.ok) setError(r.error)
          else {
            setDialog(null)
            await refreshStatus()
          }
        }} />
      )}
      {(dialog?.type === 'merge' || dialog?.type === 'rebase') && status && (
        <MergeDialog type={dialog.type} status={status} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onGo={async (branch) => {
          setBusy(dialog.type)
          const r = await window.od.git(dialog.type, { path: selectedPath, branch })
          setBusy('')
          if (!r.ok) setError(r.error)
          else {
            setDialog(null)
            await refreshStatus()
            await refreshHistory()
          }
        }} />
      )}
      {dialog?.type === 'pr' && status && (
        <PRDialog status={status} summary={summary} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onCreate={async (form) => {
          setBusy('pr')
          const r = await window.od.origin('prCreate', {
            path: selectedPath,
            repo: status.fullName,
            title: form.title,
            body: form.body,
            head: status.branch.name,
            base: form.base,
            draft: form.draft,
            push: true,
          })
          setBusy('')
          if (!r.ok) setError(r.error || r.output || 'Could not create pull request')
          else {
            setDialog(null)
            flash('Pull request created')
            await refreshPrs(status)
            const url = (r.output || '').match(/https?:\/\/\S+/)?.[0]
            if (url) window.od.shell('openExternal', { url })
          }
        }} />
      )}
      {dialog?.type === 'prefs' && (
        <PrefsDialog
          store={store}
          auth={auth}
          onClose={() => setDialog(null)}
          onApply={(patch) => persist(patch)}
          onSave={async (patch) => { await persist(patch); setDialog(null) }}
          onSignIn={() => ops.current.signIn()}
          onSignOut={async () => {
            await window.od.origin('authLogout')
            setAuth(await window.od.origin('authStatus'))
          }}
        />
      )}
      {dialog?.type === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
      {toast && (
        <div className="toast-slot">
          <div className="toast"><Icon name="check" size={14} />{toast}</div>
        </div>
      )}
      {boot !== 'off' && <BootSplash leaving={boot === 'out'} />}
    </div>
  )
}
