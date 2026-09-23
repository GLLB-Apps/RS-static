import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { Search, PanelLeftClose, PanelLeftOpen, ExternalLink } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import type { UserRole } from '../../lib/types'
import { roleLabel, usernameFromEmail } from '../../lib/utils'
import { MENU_GROUPS } from '../../lib/adminMenu'
import { NotificationsProvider, useNotifications } from '../../lib/notifications'
import { EditorDirtyProvider, useIsEditorDirty } from '../../lib/editorDirty'
import { FocusModeProvider, useFocusMode } from '../../lib/focusMode'
import { useTheme } from '../../lib/theme'
import { useConfirm } from '../../lib/confirm'
import MobileAdminNotice from './MobileAdminNotice'
import DraftRecoveryDialog from './DraftRecoveryDialog'
import CommandPalette from './CommandPalette'
import NotificationBell from './NotificationBell'
import ThemeToggle from '../ThemeToggle'

/** Delad övergång för menytexter som fälls in/ut — kort och odramatisk. */
const LABEL_MOTION = {
  initial: { opacity: 0, width: 0 },
  animate: { opacity: 1, width: 'auto' as const },
  exit: { opacity: 0, width: 0 },
  transition: { duration: 0.15 },
}

/**
 * Egen komponent eftersom AdminLayout själv tillhandahåller NotificationsProvider
 * och därför inte kan konsumera den.
 */
function AdminMenu({ role, pathname, onNavigate, collapsed }: {
  role: UserRole | null
  pathname: string
  onNavigate: () => void
  collapsed: boolean
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
            {group.title && (
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div className="admin-menu-group-title" style={{ overflow: 'hidden' }} {...LABEL_MOTION}>
                    {group.title}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
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
                  title={item.label}
                >
                  <Icon size={16} aria-hidden="true" />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span className="admin-menu-label" style={{ overflow: 'hidden', whiteSpace: 'nowrap' }} {...LABEL_MOTION}>
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
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

const SIDEBAR_COLLAPSED_KEY = 'ncc-rs:admin-sidebar-collapsed'
const SIDEBAR_WIDTH = 260
const SIDEBAR_WIDTH_COLLAPSED = 68
const TOPBAR_HEIGHT = 56

function initialSidebarCollapsed(): boolean {
  try { return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1' } catch { return false }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Egen provider här (inte i App.tsx) — dirty-läget ska bara existera medan
  // adminpanelen faktiskt är monterad, aldrig läcka till den publika sidan
  // eller intranätet.
  return (
    // reducedMotion="user" läser samma prefers-reduced-motion som CSS-varianten
    // annars (t.ex. .vb-detail-enter) redan respekterar — alla motion.dev-
    // animationer i adminpanelen stängs av automatiskt om användaren bett om det.
    <MotionConfig reducedMotion="user">
      <EditorDirtyProvider>
        <FocusModeProvider>
          <AdminLayoutInner>{children}</AdminLayoutInner>
        </FocusModeProvider>
      </EditorDirtyProvider>
    </MotionConfig>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, role, displayName, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const isEditorDirty = useIsEditorDirty()
  const { focusMode } = useFocusMode()
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Fäll in menyn till bara ikoner för en renare, mer fokuserad redigerings-
  // yta — sparas per webbläsare, precis som temat.
  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0') } catch { /* ignore */ }
  }, [sidebarCollapsed])

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
    <div className={`admin-layout ${focusMode ? 'is-focus-mode' : ''}`.trim()}>
      <MobileAdminNotice />
      <DraftRecoveryDialog />

      {/* Fokusläge döljer adminpanelens egen chrome helt (sidomeny + toppbar) —
          sidobreddens/höjdens animering gör att redigeringsytan glider ut och
          tar den frigjorda platsen i stället för att bara poppa till. */}
      <AnimatePresence initial={false}>
        {!focusMode && (
          <motion.aside
            key="admin-sidebar"
            className={`admin-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`.trim()}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{ overflowX: 'hidden', overflowY: 'auto' }}
          >
            <div className="admin-sidebar-header">
              <AnimatePresence initial={false}>
                {!sidebarCollapsed && (
                  <motion.div
                    key="sidebar-brand"
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', overflow: 'hidden' }}
                    {...LABEL_MOTION}
                  >
                    <Link to="/admin" className="admin-logo">Rögleskogen</Link>
                    <span className="admin-badge">Admin</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                className="admin-sidebar-collapse-toggle"
                onClick={() => setSidebarCollapsed(v => !v)}
                aria-label={sidebarCollapsed ? 'Visa menytexter' : 'Fäll in menyn till ikoner'}
                title={sidebarCollapsed ? 'Visa menytexter' : 'Fäll in menyn till ikoner'}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
              </button>
            </div>
            <AdminMenu role={role} pathname={location.pathname} onNavigate={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} />
            <div className="admin-sidebar-footer">
              <Link to="/" className="admin-menu-link" target="_blank" title="Visa webbplats">
                <ExternalLink size={16} aria-hidden="true" />
                <AnimatePresence initial={false}>
                  {!sidebarCollapsed && (
                    <motion.span className="admin-menu-label" style={{ overflow: 'hidden', whiteSpace: 'nowrap' }} {...LABEL_MOTION}>
                      Visa webbplats
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-overlay"
            className="admin-sidebar-overlay"
            style={{ display: 'block' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="admin-main">
        <AnimatePresence initial={false}>
          {!focusMode && (
            <motion.header
              key="admin-topbar"
              className="admin-topbar"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: TOPBAR_HEIGHT }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            >
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
                <ThemeToggle className="admin-bell-button" />
                <NotificationBell
                  avatarSeed={user?.email ?? ''}
                  email={user?.email ?? ''}
                  displayName={displayName}
                  roleLabel={role ? roleLabel(role) : ''}
                  onSignOut={handleSignOut}
                />
              </div>
            </motion.header>
          )}
        </AnimatePresence>
        <div className="admin-content">
          {children}
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        role={role}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={handleSignOut}
      />
    </div>
    </NotificationsProvider>
  )
}
