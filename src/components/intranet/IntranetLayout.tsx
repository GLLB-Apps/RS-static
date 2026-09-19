import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, FileText, StickyNote, ListChecks, Megaphone, ExternalLink } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { IntranetNotificationsProvider, useIntranetNotifications, type IntranetSource } from '../../lib/intranetNotifications'
import MobileAdminNotice from '../admin/MobileAdminNotice'
import IntranetBell from './IntranetBell'

// `source` kopplar en menypost till en notiskälla → badge med antal nya.
type Item = { label: string; path: string; icon: typeof LayoutGrid; source: IntranetSource }

// Medlemshantering bor på adminpanelens Behörigheter-sida, inte här.
const ITEMS: Item[] = [
  { label: 'Anslagstavla', path: '/internt', icon: Megaphone, source: 'notices' },
  { label: 'Dokument', path: '/internt/dokument', icon: FileText, source: 'documents' },
  { label: 'Anteckningar', path: '/internt/anteckningar', icon: StickyNote, source: 'notes' },
  { label: 'Uppgifter', path: '/internt/uppgifter', icon: ListChecks, source: 'tasks' },
]

function IntranetNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { newBySource } = useIntranetNotifications()
  return (
    <nav className="admin-menu" aria-label="Intranätsmeny">
      <div className="admin-menu-group">
        {ITEMS.map(item => {
          const active = item.path === '/internt' ? pathname === '/internt' : pathname.startsWith(item.path)
          const Icon = item.icon
          const count = newBySource[item.source]
          return (
            <Link
              key={item.path}
              to={item.path}
              className={active ? 'admin-menu-link active' : 'admin-menu-link'}
              onClick={onNavigate}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="admin-menu-label">{item.label}</span>
              {count > 0 && <span className="admin-menu-badge" aria-label={`${count} nya`}>{count > 99 ? '99+' : count}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function IntranetLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, canWriteIntranet, displayName, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <IntranetNotificationsProvider>
      <div className="admin-layout">
        <MobileAdminNotice />
        <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
          <div className="admin-sidebar-header">
            <Link to="/internt" className="admin-logo">Rögleskogen</Link>
            <span className="admin-badge">Internt</span>
          </div>
          <IntranetNav pathname={location.pathname} onNavigate={() => setOpen(false)} />
          <div className="admin-sidebar-footer">
            {isAdmin && (
              <Link to="/admin" className="admin-menu-link">
                <LayoutGrid size={16} aria-hidden="true" /> <span className="admin-menu-label">Till adminpanelen</span>
              </Link>
            )}
            <Link to="/" className="admin-menu-link" target="_blank">
              <ExternalLink size={16} aria-hidden="true" /> <span className="admin-menu-label">Visa webbplats</span>
            </Link>
          </div>
        </aside>

        {open && <div className="admin-sidebar-overlay" onClick={() => setOpen(false)} />}

        <div className="admin-main">
          <header className="admin-topbar">
            <button className="admin-sidebar-toggle" onClick={() => setOpen(!open)} aria-label="Visa/dölj meny">☰</button>
            <div className="intranet-topbar-title">Internt arbetsrum</div>
            <div className="admin-user-menu">
              <IntranetBell
                avatarSeed={user?.email ?? ''}
                email={user?.email ?? ''}
                displayName={displayName}
                roleLabel={isAdmin ? 'Admin' : canWriteIntranet ? 'Medlem' : 'Läsbehörighet'}
                onSignOut={handleSignOut}
              />
            </div>
          </header>
          <div className="admin-content">
            {!canWriteIntranet && (
              <div className="intranet-readonly-banner">
                Du har <strong>läsbehörighet</strong> – du kan läsa allt i arbetsrummet men inte skapa eller ändra.
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </IntranetNotificationsProvider>
  )
}
