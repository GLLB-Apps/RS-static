import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LogOut, Sun, Moon, FileText, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { usernameFromEmail } from '../../lib/utils'
import { PAGES } from '../../lib/pages'
import { MENU_GROUPS, CREATE_COMMANDS } from '../../lib/adminMenu'
import type { UserRole } from '../../lib/types'
import UserAvatar from '../UserAvatar'

interface Command {
  id: string
  label: string
  group: 'Skapa nytt' | 'Sidor' | 'Konto'
  icon: LucideIcon
  action: () => void
}

const GROUP_ORDER: Command['group'][] = ['Skapa nytt', 'Sidor', 'Konto']

interface Props {
  open: boolean
  onClose: () => void
  role: UserRole | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onSignOut: () => void
}

/**
 * Kommandopalett i shadcn/cmdk-anda (se ui.shadcn.com/docs/components/base/command):
 * en helskärmsdialog i stället för den gamla lilla sökrutans dropdown. Öppnas
 * med Ctrl/Cmd+K var man än är i adminpanelen, eller genom att klicka den
 * knapp som ser ut som en sökruta i toppbaren.
 */
export default function CommandPalette({ open, onClose, role, theme, onToggleTheme, onSignOut }: Props) {
  const { user, displayName } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlighted(0)
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = []
    for (const c of CREATE_COMMANDS) {
      if (role && c.roles.includes(role)) {
        list.push({ id: `create:${c.path}`, label: c.label, group: 'Skapa nytt', icon: c.icon, action: () => navigate(c.path) })
      }
    }
    for (const group of MENU_GROUPS) {
      for (const item of group.items) {
        if (role && item.roles.includes(role)) {
          list.push({ id: `nav:${item.path}`, label: item.label, group: 'Sidor', icon: item.icon, action: () => navigate(item.path) })
        }
      }
    }
    for (const p of PAGES) {
      list.push({ id: `page:${p.slug}`, label: `Sida · ${p.label}`, group: 'Sidor', icon: FileText, action: () => navigate(`/admin/sidor/${p.slug}`) })
    }
    list.push({ id: 'account:theme', label: theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge', group: 'Konto', icon: theme === 'dark' ? Sun : Moon, action: onToggleTheme })
    list.push({ id: 'account:signout', label: 'Logga ut', group: 'Konto', icon: LogOut, action: onSignOut })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, theme])

  const q = query.trim().toLowerCase()
  // Matchar både kommandots egen text och dess kategori — "skapa" ska hitta
  // hela "Skapa nytt"-gruppen, inte bara ett kommando som råkar heta så.
  const filtered = q
    ? commands.filter(c => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
    : commands
  const grouped = GROUP_ORDER
    .map(group => ({ group, items: filtered.filter(c => c.group === group) }))
    .filter(g => g.items.length > 0)

  function run(cmd: Command) {
    onClose()
    cmd.action()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(i => Math.min(i + 1, filtered.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) run(filtered[highlighted]); return }
  }

  if (!open) return null

  const welcomeName = displayName || (user?.email ? usernameFromEmail(user.email) : '')
  let flatIndex = -1

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Kommandopalett" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <h2>Vad letar du efter{welcomeName ? <>, {welcomeName}</> : ''}?</h2>
          <UserAvatar seed={user?.email ?? 'sok'} size={120} caretOf={inputRef} title="Din Rögleblobb" />
        </div>
        <div className="command-palette-input-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
            onKeyDown={onKeyDown}
            placeholder="Sök sidor, eller skapa nytt…"
            aria-label="Kommandopalett"
          />
        </div>
        <div className="command-palette-results">
          {grouped.length === 0 ? (
            <p className="command-palette-empty">Inget matchar "{query}".</p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="command-palette-group-label">{group}</div>
                {items.map(cmd => {
                  flatIndex += 1
                  const isActive = flatIndex === highlighted
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      ref={isActive ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                      className={isActive ? 'command-palette-item is-active' : 'command-palette-item'}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => run(cmd)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {cmd.label}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
