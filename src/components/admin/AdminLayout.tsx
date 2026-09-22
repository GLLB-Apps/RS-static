import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import type { UserRole } from '../../lib/types'
import { roleLabel, usernameFromEmail } from '../../lib/utils'
import { MENU_GROUPS } from '../../lib/adminMenu'
import { NotificationsProvider, useNotifications } from '../../lib/notifications'
import { EditorDirtyProvider, useIsEditorDirty } from '../../lib/editorDirty'
import { useConfirm } from '../../lib/confirm'
import MobileAdminNotice from './MobileAdminNotice'
import DraftRecoveryDialog from './DraftRecoveryDialog'
import CommandPalette from './CommandPalette'
import NotificationBell from './NotificationBell'

/**
 * Egen komponent eftersom AdminLayout själv tillhandahåller NotificationsProvider
 * och därför inte kan konsumera den.
 */
function AdminMenu({ role, pathname, onNavigate }: {
  role: UserRole | null
  pathname: string
  onNavigate: () => void
}) {
  // Badgen läses här, men nollställs inte av klicket — respektive sida markerar
  // sin källa som läst först när den faktiskt visats en stund.
  const { newBySource } = useNotifications()

  return (
    <nav className="admin-menu" aria-label="Adminmeny">
      {MENU_GROUPS.map((group, gi) => {
        const items = group.items.filter(item => role && item.roles.includes(role))
        if (items.length === 0) return null
        return (
          <div className="admin-menu-group" key={gi}>
            {group.title && <div className="admin-menu-group-title">{group.title}</div>}
            {items.map(item => {
              const isActive = item.path === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.path)
              // "Internt arbetsrum" samlar alla intranätskällor i en badge.
              const count = item.path === '/internt'
                ? newBySource.notices + newBySource.notes + newBySource.tasks + newBySource.documents
                : item.source ? newBySource[item.source] : 0
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={isActive ? 'admin-menu-link active' : 'admin-menu-link'}
                  onClick={onNavigate}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="admin-menu-label">{item.label}</span>
                  {count > 0 && (
                    <span className="admin-menu-badge" aria-label={`${count} nya`}>{count > 99 ? '99+' : count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

const THEME_KEY = 'ncc-rs:admin-theme'

/** Sparat val, annars systemets färgschema, annars ljust. */
function initialTheme(): 'light' | 'dark' {
  try {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* privat läge, blockerad lagring m.m. */ }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* okänd preferens */ }
  return 'light'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Egen provider här (inte i App.tsx) — dirty-läget ska bara existera medan
  // adminpanelen faktiskt är monterad, aldrig läcka till den publika sidan
  // eller intranätet.
  return (
    <EditorDirtyProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </EditorDirtyProvider>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, role, displayName, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const isEditorDirty = useIsEditorDirty()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Sätts på <html> (inte bara .admin-layout) så att toasts och dialogrutor
  // också nås — ToastProvider/ConfirmProvider monteras i App.tsx ovanför hela
  // routningen, utanför AdminLayouts eget DOM-träd. Tas bort vid unmount så
  // publika sidan/intranätet aldrig ärver det.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
    return () => { delete document.documentElement.dataset.theme }
  }, [theme])

  // Ctrl/Cmd+K öppnar kommandopaletten var man än står i adminpanelen.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const breadcrumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map(seg => decodeURIComponent(seg))

  async function handleSignOut() {
    // Ett osparat utkast (autosparningens debounce har inte hunnit skriva
    // den senaste ändringen till webbläsaren än) — fråga en gång till, så
    // att den sista meningen inte försvinner mellan tangenttryck och utloggning.
    if (isEditorDirty()) {
      const name = displayName || (user?.email ? usernameFromEmail(user.email) : '')
      const ok = await confirm({
        message: `Du har skrivit något som inte hunnit autosparas än${name ? `, ${name}` : ''}. Vill du verkligen logga ut?`,
        confirmText: 'Logga ut',
        danger: true,
      })
      if (!ok) return
    }
    await signOut()
    navigate('/admin/login')
  }

  return (
    <NotificationsProvider>
    <div className="admin-layout">
      <MobileAdminNotice />
      <DraftRecoveryDialog />
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link to="/admin" className="admin-logo">Rögleskogen</Link>
          <span className="admin-badge">Admin</span>
        </div>
        <AdminMenu role={role} pathname={location.pathname} onNavigate={() => setSidebarOpen(false)} />
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-menu-link" target="_blank">Visa webbplats →</Link>
        </div>
      </aside>

      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Visa/dölj meny"
          >
            ☰
          </button>

          <button type="button" className="admin-search-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={15} aria-hidden="true" />
            <span>Sök, eller skapa nytt…</span>
            <kbd>Ctrl K</kbd>
          </button>

          <nav className="admin-breadcrumbs" aria-label="Brödsmulor">
            <Link to="/admin">Admin</Link>
            {breadcrumbs.slice(1).map((seg, i) => (
              <span key={i}>
                <span className="admin-breadcrumb-sep">/</span>
                <span>{seg}</span>
              </span>
            ))}
          </nav>
          <div className="admin-user-menu">
            <button
              type="button"
              className="admin-bell-button"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
              title={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
            >
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <NotificationBell
              avatarSeed={user?.email ?? ''}
              email={user?.email ?? ''}
              displayName={displayName}
              roleLabel={role ? roleLabel(role) : ''}
              onSignOut={handleSignOut}
            />
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        role={role}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onSignOut={handleSignOut}
      />
    </div>
    </NotificationsProvider>
  )
}
