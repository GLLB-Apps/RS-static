import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Mail, MessageSquareQuote, FileEdit, Megaphone, StickyNote, ListChecks, FileText, LogOut } from 'lucide-react'
import { useNotifications, NOTIFICATION_SOURCES, timeAgo, type NotificationSource } from '../../lib/notifications'
import { usernameFromEmail } from '../../lib/utils'
import UserAvatar from '../UserAvatar'

const SOURCE_ICONS: Record<NotificationSource, typeof Mail> = {
  messages: Mail,
  testimonies: MessageSquareQuote,
  drafts: FileEdit,
  notices: Megaphone,
  notes: StickyNote,
  tasks: ListChecks,
  documents: FileText,
}

export default function NotificationBell({ avatarSeed, email, displayName, roleLabel, onSignOut }: {
  /** Vanligtvis den inloggades e-post — samma figur överallt personen syns. */
  avatarSeed: string
  email: string
  /** Visningsnamnet från registreringen, om personen har ett. */
  displayName?: string | null
  roleLabel: string
  onSignOut: () => void
}) {
  const { items, newCount, newBySource, loading, error, clearableCount, markAllRead, clearRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Stäng vid klick utanför och på Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function goTo(path: string) {
    setOpen(false)
    navigate(path)
  }

  const label = newCount > 0 ? `Konto och notiser (${newCount} nya)` : 'Konto och notiser'

  return (
    <div className="admin-bell" ref={wrapRef}>
      <button
        type="button"
        className="admin-bell-button"
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <UserAvatar seed={avatarSeed || email} size={28} gaze />
        {newCount > 0 && <span className="admin-bell-badge">{newCount > 99 ? '99+' : newCount}</span>}
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          className="admin-bell-panel"
          role="dialog"
          aria-label="Konto och notiser"
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.15 }}
        >
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
            <strong>Notiser</strong>
            <span className="admin-bell-actions">
              {newCount > 0 && (
                <button type="button" className="admin-bell-mark" onClick={markAllRead}>
                  Markera alla som lästa
                </button>
              )}
              {clearableCount > 0 && (
                <button
                  type="button"
                  className="admin-bell-mark"
                  onClick={clearRead}
                  data-tooltip="Döljer lästa notiser. Olästa står kvar."
                >
                  Rensa lästa ({clearableCount})
                </button>
              )}
            </span>
          </div>

          {newCount > 0 && (
            <div className="admin-bell-summary">
              {(Object.keys(NOTIFICATION_SOURCES) as NotificationSource[]).map(key => {
                if (newBySource[key] === 0) return null
                const Icon = SOURCE_ICONS[key]
                return (
                  <button key={key} type="button" className="admin-bell-chip" onClick={() => goTo(NOTIFICATION_SOURCES[key].path)}>
                    <Icon size={13} aria-hidden="true" />
                    {NOTIFICATION_SOURCES[key].label} <span className="admin-bell-chip-count">{newBySource[key]}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="admin-bell-list">
            {error && <p className="admin-bell-error">{error}</p>}
            {loading ? (
              <p className="admin-bell-empty">Laddar…</p>
            ) : items.length === 0 ? (
              <p className="admin-bell-empty">Inget har kommit in ännu.</p>
            ) : (
              items.map(item => {
                const Icon = SOURCE_ICONS[item.source]
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
                      {NOTIFICATION_SOURCES[item.source].label} · {item.subtitle} · {timeAgo(item.created_at)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
