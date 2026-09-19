import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import type { UserRole } from '../../lib/types'
import { roleLabel } from '../../lib/utils'
import { PAGES } from '../../lib/pages'
import { NotificationsProvider, useNotifications, type NotificationSource } from '../../lib/notifications'
import MobileAdminNotice from './MobileAdminNotice'
import NotificationBell from './NotificationBell'

// `source` kopplar menyposten till en notiskälla: den får en badge med antalet
// nya, och att öppna posten markerar just den källan som läst.
type MenuItem = { label: string; path: string; roles: UserRole[]; source?: NotificationSource }
const MENU_GROUPS: { title: string | null; items: MenuItem[] }[] = [
  {
    title: null,
    items: [
      { label: 'Översikt', path: '/admin', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Utkast', path: '/admin/utkast', roles: ['superadmin', 'redaktor', 'skribent'], source: 'drafts' },
    ],
  },
  {
    title: 'Innehåll',
    items: [
      { label: 'Sidor', path: '/admin/sidor', roles: ['superadmin', 'redaktor'] },
      { label: 'Fristående sidor', path: '/admin/egna-sidor', roles: ['superadmin', 'redaktor'] },
      { label: 'Nyheter', path: '/admin/nyheter', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Ämnesområden', path: '/admin/amnen', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Dokument', path: '/admin/dokument', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Media', path: '/admin/media', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Karta', path: '/admin/karta', roles: ['superadmin', 'redaktor'] },
      { label: 'Tidslinje', path: '/admin/tidslinje', roles: ['superadmin', 'redaktor'] },
      { label: 'FAQ', path: '/admin/faq', roles: ['superadmin', 'redaktor'] },
    ],
  },
  {
    title: 'Kommunikation',
    items: [
      { label: 'Vittnesmål', path: '/admin/vittnesmal', roles: ['superadmin', 'redaktor'], source: 'testimonies' },
      { label: 'Meddelanden', path: '/admin/meddelanden', roles: ['superadmin', 'redaktor'], source: 'messages' },
      { label: 'Kontakter', path: '/admin/kontakter', roles: ['superadmin', 'redaktor'] },
      { label: 'Sponsorer', path: '/admin/sponsorer', roles: ['superadmin', 'redaktor'] },
    ],
  },
  {
    title: 'Webbplats',
    items: [
      { label: 'Hero (startsida)', path: '/admin/hero', roles: ['superadmin', 'redaktor'] },
      { label: 'Sidfot', path: '/admin/sidfot', roles: ['superadmin', 'redaktor'] },
      { label: 'Meny', path: '/admin/meny', roles: ['superadmin', 'redaktor'] },
      { label: 'Inställningar', path: '/admin/inställningar', roles: ['superadmin'] },
      { label: 'Användare', path: '/admin/administratörer', roles: ['superadmin'] },
    ],
  },
  {
    title: 'Internt',
    items: [
      { label: 'Internt arbetsrum', path: '/internt', roles: ['superadmin', 'redaktor', 'skribent'] },
    ],
  },
  {
    title: 'Hjälp',
    items: [
      { label: 'Handbok', path: '/admin/handbok', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Ändringslogg', path: '/admin/andringslogg', roles: ['superadmin', 'redaktor', 'skribent'] },
    ],
  },
]

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
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={isActive ? 'admin-menu-link active' : 'admin-menu-link'}
                  onClick={onNavigate}
                >
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
  const { user, role, displayName, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)

  // Sätts på <html> (inte bara .admin-layout) så att toasts och dialogrutor
  // också nås — ToastProvider/ConfirmProvider monteras i App.tsx ovanför hela
  // routningen, utanför AdminLayouts eget DOM-träd. Tas bort vid unmount så
  // publika sidan/intranätet aldrig ärver det.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
    return () => { delete document.documentElement.dataset.theme }
  }, [theme])

  const destinations = useMemo(() => {
    const items: { label: string; path: string }[] = []
    for (const group of MENU_GROUPS) {
      for (const item of group.items) {
        if (role && item.roles.includes(role)) items.push({ label: item.label, path: item.path })
      }
    }
    for (const p of PAGES) items.push({ label: `Sida · ${p.label}`, path: `/admin/sidor/${p.slug}` })
    return items
  }, [role])

  const q = query.trim().toLowerCase()
  const results = q ? destinations.filter(d => d.label.toLowerCase().includes(q)).slice(0, 8) : []
  function go(path: string) { setQuery(''); navigate(path) }

  const breadcrumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map(seg => decodeURIComponent(seg))

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <NotificationsProvider>
    <div className="admin-layout">
      <MobileAdminNotice />
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

          <div className="admin-search">
            <input
              className="admin-search-input"
              type="text"
              placeholder="Sök – hoppa till valfri sida eller sektion…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && results[0]) go(results[0].path)
                if (e.key === 'Escape') setQuery('')
              }}
              aria-label="Sök i adminpanelen"
            />
            {results.length > 0 && (
              <div className="admin-search-results">
                {results.map(r => (
                  <button
                    key={r.path}
                    type="button"
                    className="admin-search-result"
                    onMouseDown={e => { e.preventDefault(); go(r.path) }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
    </div>
    </NotificationsProvider>
  )
}
