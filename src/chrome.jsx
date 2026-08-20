import { useState } from 'react'
import { Icon, LogoMark } from './icons.jsx'
import { accountHandle, initials, avatarColor, syncAction, filterRepos } from './display.js'

export function BootSplash({ leaving }) {
  return (
    <div className={`splash-overlay ${leaving ? 'leaving' : ''}`}>
      <div className="splash-glow" aria-hidden />
      <div className="splash-mark">
        <LogoMark size={108} />
      </div>
      <p className="splash-title">Origin Desktop</p>
      <p className="splash-copy">Cursor Origin</p>
    </div>
  )
}

export function AccountAvatar({ url, name, size = 26 }) {
  const handle = accountHandle(name)
  if (url) {
    return <img className="avatar-img" src={url} width={size} height={size} alt="" style={{ width: size, height: size }} />
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)), background: avatarColor(name) }}>
      {initials(handle)}
    </span>
  )
}

export function Toolbar({
  currentRepo,
  status,
  prs,
  popover,
  busy,
  accountName,
  avatarUrl,
  onRepo,
  onBranch,
  onFetch,
  onAccount,
}) {
  const fetchAction = syncAction(status)
  return (
    <div className="toolbar" onClick={(e) => e.stopPropagation()}>
      <button className={`toolbar-btn repo ${popover === 'repo' ? 'active' : ''}`} onClick={onRepo} title={currentRepo?.fullName || currentRepo?.name || 'Choose a repository'}>
        <span className="glyph"><Icon name="repo" size={16} /></span>
        <span className="meta">
          <span className="label">Repository</span>
          <span className="value">{currentRepo?.name || 'Choose a repository'}</span>
        </span>
        <Icon name="arrow-down" />
      </button>
      <button className={`toolbar-btn branch ${popover === 'branch' ? 'active' : ''}`} disabled={!currentRepo} onClick={onBranch} title={status?.branch?.name || 'Branch'}>
        <span className="glyph"><Icon name="git-branch" size={16} /></span>
        <span className="meta">
          <span className="label">Branch</span>
          <span className="value">{status?.branch?.name || '—'}</span>
        </span>
        {prs.length ? <span className="badge">{prs.length}</span> : null}
        <Icon name="arrow-down" />
      </button>
      <div className="toolbar-spacer" />
      <div className="toolbar-end">
        {currentRepo && (
          <button className="fetch-btn" disabled={Boolean(busy)} onClick={onFetch} title={fetchAction.diverged ? 'This branch has diverged from Origin' : fetchAction.label}>
            <Icon name={fetchAction.icon} className={busy ? 'spin' : ''} />
            <span className="fetch-label">{fetchAction.label}</span>
            {fetchAction.count ? <span className={`badge ${fetchAction.kind || ''}`}>{fetchAction.count}</span> : null}
          </button>
        )}
        <button className="account-chip" onClick={onAccount} title={accountName}>
          <AccountAvatar url={avatarUrl} name={accountName} size={26} />
        </button>
      </div>
    </div>
  )
}

export function RepoPopover({ repos, selectedPath, query, onQuery, onSelect, onCreate, onAdd, onClone }) {
  const visible = filterRepos(repos, query)
  return (
    <div className="popover" onClick={(e) => e.stopPropagation()}>
      <div className="popover-head">
        <div className="filter-wrap" style={{ flex: 1 }}>
          <Icon name="search" className="search-ic" />
          <input className="field" placeholder="Filter repositories" value={query} onChange={(e) => onQuery(e.target.value)} autoFocus style={{ paddingLeft: 32 }} />
        </div>
      </div>
      <div className="popover-list">
        {visible.map((r) => (
          <div key={r.path} className={`repo-row ${r.path === selectedPath ? 'selected' : ''}`} onClick={() => onSelect(r)}>
            <Icon name="repo" />
            <div className="commit-meta">
              <div className="subject">{r.name}</div>
              <div className="kicker">{r.fullName || r.path}</div>
            </div>
            {r.isOrigin ? <span className="host-pill">Cursor Origin</span> : null}
          </div>
        ))}
        {!visible.length && (
          <div className="empty">
            <p>{repos.length ? 'No repositories match that filter.' : 'No local repositories yet. Clone one from Origin to begin.'}</p>
          </div>
        )}
      </div>
      <div className="popover-foot">
        <button className="btn secondary small" onClick={onCreate}>Create</button>
        <button className="btn secondary small" onClick={onAdd}>Add</button>
        <button className="btn small" onClick={onClone}>Clone from Cursor Origin</button>
      </div>
    </div>
  )
}

export function BranchPopover({ status, prs, onClose, onNew, onCheckout, onCheckoutPr }) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('branches')
  const locals = status.branches.local.filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()))
  const remotes = status.branches.remote.filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="popover branch" onClick={(e) => e.stopPropagation()}>
      <div className="popover-head">
        <div className="filter-wrap">
          <Icon name="search" className="search-ic" />
          <input className="field" placeholder="Filter branches" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 32 }} autoFocus />
        </div>
        <button className="btn small" onClick={onNew}>New</button>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>Branches</button>
        <button className={`tab ${tab === 'prs' ? 'active' : ''}`} onClick={() => setTab('prs')}>
          Pull Requests {prs.length ? <span className="count">{prs.length}</span> : null}
        </button>
      </div>
      <div className="popover-list">
        {tab === 'branches' && (
          <>
            <div className="section-label">Local</div>
            {locals.map((b) => (
              <div key={b.name} className={`branch-row ${b.current ? 'selected' : ''}`} onClick={() => onCheckout(b.name)}>
                {b.current ? <Icon name="check" /> : <span style={{ width: 16 }} />}
                <Icon name="git-branch" />
                <span className="path">{b.name}</span>
              </div>
            ))}
            {remotes.length > 0 && <div className="section-label">Origin</div>}
            {remotes.map((b) => (
              <div key={b.name} className="branch-row" onClick={() => onCheckout(b.name)}>
                <span style={{ width: 16 }} />
                <Icon name="git-branch" />
                <span className="path">{b.name}</span>
              </div>
            ))}
          </>
        )}
        {tab === 'prs' && (
          <>
            {prs.length === 0 && <div className="empty"><p>No open pull requests.</p></div>}
            {prs.map((pr) => (
              <div key={pr.number} className="pr-row" onClick={() => onCheckoutPr(pr)}>
                <Icon name="pr" />
                <div className="commit-meta">
                  <div className="subject">#{pr.number} {pr.title}</div>
                  <div className="kicker">{pr.headRef} → {pr.baseRef}</div>
                </div>
                <span className={`pr-status ${String(pr.status || 'open').toLowerCase()}`}>{pr.status || 'open'}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="popover-foot">
        <button className="btn secondary small" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
