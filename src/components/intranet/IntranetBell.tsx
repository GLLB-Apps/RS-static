import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone, StickyNote, ListChecks, FileText, LogOut } from 'lucide-react'
import { useIntranetNotifications, INTRANET_SOURCES, type IntranetSource } from '../../lib/intranetNotifications'
import { timeAgo } from '../../lib/notifications'
import { usernameFromEmail } from '../../lib/utils'
import UserAvatar from '../UserAvatar'

const ICONS: Record<IntranetSource, typeof Megaphone> = {
  notices: Megaphone,
  notes: StickyNote,
  tasks: ListChecks,
  documents: FileText,
}

// Konto- och notisknapp i intranätets topbar. Visar bara intranätsinnehåll.
export default function IntranetBell({ avatarSeed, email, displayName, roleLabel, onSignOut }: {
  avatarSeed: string
  email: string
  /** Visningsnamnet från registreringen, om personen har ett. */
  displayName?: string | null
  roleLabel: string
  onSignOut: () => void
}) {
  const { items, newCount, newBySource, loading, markAllRead } = useIntranetNotifications()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function goTo(path: string) { setOpen(false); navigate(path) }

  return (
    <div className="admin-bell" ref={wrapRef}>
      <button
        type="button"
        className="admin-bell-button"
        onClick={() => setOpen(v => !v)}
        aria-label={newCount > 0 ? `Konto och notiser (${newCount} nya)` : 'Konto och notiser'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <UserAvatar seed={avatarSeed || email} size={28} gaze />
        {newCount > 0 && <span className="admin-bell-badge">{newCount > 99 ? '99+' : newCount}</span>}
      </button>

      {open && (
        <div className="admin-bell-panel" role="dialog" aria-label="Konto och notiser">
          <div className="admin-bell-account">
            <UserAvatar seed={avatarSeed || email} size={40} />
            <div className="admin-bell-account-info">
              <strong>Hej {displayName || usernameFromEmail(email)}</strong>
              <span className="admin-bell-account-meta">
                <span className="admin-bell-account-email">{email}</span>
                <span className="badge badge-muted">{roleLabel}</span>
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSignOut}>
              <LogOut size={15} aria-hidden="true" /> Logga ut
            </button>
          </div>

          <div className="admin-bell-header">
            <strong>Nytt i intranätet</strong>
            {newCount > 0 && <button type="button" className="admin-bell-mark" onClick={markAllRead}>Markera alla som lästa</button>}
          </div>

          {newCount > 0 && (
            <div className="admin-bell-summary">
              {(Object.keys(INTRANET_SOURCES) as IntranetSource[]).map(key => {
                if (newBySource[key] === 0) return null
                const Icon = ICONS[key]
                return (
                  <button key={key} type="button" className="admin-bell-chip" onClick={() => goTo(INTRANET_SOURCES[key].path)}>
                    <Icon size={13} aria-hidden="true" />
                    {INTRANET_SOURCES[key].label} <span className="admin-bell-chip-count">{newBySource[key]}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="admin-bell-list">
            {loading ? (
              <p className="admin-bell-empty">Laddar…</p>
            ) : items.length === 0 ? (
              <p className="admin-bell-empty">Inget i intranätet ännu.</p>
            ) : (
              items.map(item => {
                const Icon = ICONS[item.source]
                return (
                  <button
                    key={`${item.source}-${item.id}`}
                    type="button"
                    className={item.isNew ? 'admin-bell-item is-new' : 'admin-bell-item'}
                    onClick={() => goTo(item.path)}
                  >
                    <span className="admin-bell-item-top">
                      <Icon size={14} className="admin-bell-item-icon" aria-hidden="true" />
                      <span className="admin-bell-item-title">{item.title}</span>
                      {item.isNew && <span className="admin-bell-dot" aria-label="Ny" />}
                    </span>
                    <span className="admin-bell-item-meta">
                      {INTRANET_SOURCES[item.source].label} · {timeAgo(item.at)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
