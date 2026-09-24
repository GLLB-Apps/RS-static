import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import type { SiteSettings, NavigationItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import NavIcon from './NavIcon'
import LucideIcon, { resolveIconName } from '../../lib/lucide'
import CountUp from './CountUp'
import { getCampaign } from '../../lib/campaign'
import CampaignLink from './CampaignLink'
import ThemeToggle from '../ThemeToggle'

export default function Header({ settings }: { settings: SiteSettings | null }) {
  const [navItems, setNavItems] = useState<NavigationItem[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()
  const campaign = getCampaign(settings)

  // When scrolled, the logo badge retracts to the header's current height.
  // Hysteres: brickan fälls ihop först vid 24px och ut igen först vid 4px. Med
  // en enda brytpunkt kunde tröga rullningar (styrplattor, Chromes utrullning)
  // studsa över gränsen och få brickan att blinka fram och tillbaka.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      setScrolled(prev => (prev ? y > 4 : y >= 24))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    supabase
      .from('navigation_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setNavItems(data ?? []))
  }, [])

  // Även ett byte av bara filtret (?kategori=…) stänger mobilmenyn.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const topLevel = navItems.filter(i => !i.parent_id)
  const childrenOf = (id: string) => navItems.filter(i => i.parent_id === id)
  // En menypost kan peka på en filtrerad vy (t.ex. /nyheter?kategori=pressklipp).
  // Då är det den posten som är aktiv, inte den ofiltrerade sidan.
  const isCurrent = (url: string) => url.includes('?')
    ? url === location.pathname + location.search
    : url === location.pathname && !location.search
  // The logo badge hangs down below the header at the top of any page, and
  // retracts to a compact size once scrolled or when the mobile menu is open
  // (so it doesn't cover the first drawer item).
  const expanded = !scrolled && !mobileOpen

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close on Escape.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
    <header className={expanded ? 'site-header header-expanded' : 'site-header'}>
      {settings?.status_message && (
        <div className="status-bar">
          <div className="container">
            <span className="status-bar-text">{settings.status_message}</span>
          </div>
        </div>
      )}
      <div className="container header-inner">
        <Link to="/" className="site-logo" aria-label={settings?.site_name ?? 'Rögleskogen'}>
          {settings?.logo_url ? (
            <>
              {/* Sloten håller brickans plats i raden konstant — brickan själv
                  växer utanför den när den fälls ut. Se .site-logo-slot i CSS:en. */}
              <span className="site-logo-slot">
                <span className="site-logo-badge">
                  <img src={settings.logo_url} alt={settings.site_name} className="logo-img" />
                </span>
              </span>
              <span className="site-logo-name">{settings?.site_name ?? 'Rögleskogen'}</span>
            </>
          ) : (
            <span className="logo-text">
              <span className="logo-name">{settings?.site_name ?? 'Rögleskogen'}</span>
              <span className="logo-subtitle">{settings?.site_subtitle}</span>
            </span>
          )}
        </Link>

        <nav className="main-nav" aria-label="Huvudmeny">
          {topLevel.map(item => {
            const children = childrenOf(item.id)
            if (children.length === 0) {
              return item.url ? (
                <Link
                  key={item.id}
                  to={item.url}
                  className={isCurrent(item.url) ? 'nav-link active' : 'nav-link'}
                >
                  {resolveIconName(item.icon) ? <LucideIcon icon={item.icon} className="nav-drawer-icon" /> : <NavIcon path={item.url} />}{item.label}
                </Link>
              ) : null
            }
            const groupActive = children.some(c => isCurrent(c.url))
            return (
              <div className="nav-group" key={item.id}>
                {item.url ? (
                  <Link to={item.url} className={groupActive ? 'nav-link nav-group-trigger active' : 'nav-link nav-group-trigger'}>
                    {resolveIconName(item.icon) && <LucideIcon icon={item.icon} className="nav-drawer-icon" />}{item.label}<span className="nav-caret" aria-hidden="true">▾</span>
                  </Link>
                ) : (
                  <button type="button" className={groupActive ? 'nav-link nav-group-trigger active' : 'nav-link nav-group-trigger'} aria-haspopup="true">
                    {resolveIconName(item.icon) && <LucideIcon icon={item.icon} className="nav-drawer-icon" />}{item.label}<span className="nav-caret" aria-hidden="true">▾</span>
                  </button>
                )}
                <div className="nav-dropdown">
                  {children.map(c => (
                    <Link
                      key={c.id}
                      to={c.url}
                      className={isCurrent(c.url) ? 'nav-dropdown-link active' : 'nav-dropdown-link'}
                    >
                      {resolveIconName(c.icon) ? <LucideIcon icon={c.icon} className="nav-drawer-icon" /> : <NavIcon path={c.url} />}{c.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="header-actions">
          {user && (
            <button
              type="button"
              className="btn btn-ghost btn-sm header-logout"
              onClick={() => signOut()}
              data-tooltip="Logga ut"
              aria-label="Logga ut"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="header-logout-label">Logga ut</span>
            </button>
          )}
          {campaign && <CampaignLink campaign={campaign} className="btn btn-primary btn-sm" />}
          <ThemeToggle className="theme-toggle" />
          <button
            className={mobileOpen ? 'mobile-toggle open' : 'mobile-toggle'}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Stäng meny' : 'Öppna meny'}
            aria-expanded={mobileOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>

      <div
        className={mobileOpen ? 'mobile-nav-backdrop open' : 'mobile-nav-backdrop'}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav
        className={mobileOpen ? 'mobile-nav open' : 'mobile-nav'}
        aria-label="Mobilmeny"
        aria-hidden={!mobileOpen}
      >
        <ul className="mobile-nav-list">
          {topLevel.map((item, i) => {
            const children = childrenOf(item.id)
            return (
              <li key={item.id} style={{ '--i': String(i) } as CSSProperties}>
                {item.url ? (
                  <Link
                    to={item.url}
                    className={isCurrent(item.url) ? 'mobile-nav-link active' : 'mobile-nav-link'}
                    tabIndex={mobileOpen ? 0 : -1}
                  >
                    <span className="mobile-nav-link-icon">{resolveIconName(item.icon) ? <LucideIcon icon={item.icon} className="nav-drawer-icon" /> : <NavIcon path={item.url} />}</span>
                    <span className="mobile-nav-link-label">{item.label}</span>
                    <span className="mobile-nav-link-arrow" aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <div className="mobile-nav-grouplabel">
                    {resolveIconName(item.icon) && <LucideIcon icon={item.icon} className="nav-drawer-icon" />}
                    {item.label}
                  </div>
                )}
                {children.length > 0 && (
                  <ul className="mobile-nav-sublist">
                    {children.map(c => (
                      <li key={c.id}>
                        <Link
                          to={c.url}
                          className={isCurrent(c.url) ? 'mobile-nav-link mobile-nav-sublink active' : 'mobile-nav-link mobile-nav-sublink'}
                          tabIndex={mobileOpen ? 0 : -1}
                        >
                          <span className="mobile-nav-link-icon">{resolveIconName(c.icon) ? <LucideIcon icon={c.icon} className="nav-drawer-icon" /> : <NavIcon path={c.url} />}</span>
                          <span className="mobile-nav-link-label">{c.label}</span>
                          <span className="mobile-nav-link-arrow" aria-hidden="true">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        {campaign && (
          <div className="mobile-nav-widget">
            {campaign.showSignatures ? (
              <>
                <span className="vote-widget-label">Underskrifter</span>
                <span className="vote-widget-count"><CountUp value={settings?.signature_count ?? 0} /></span>
                <p className="vote-widget-text">Var med och gör skillnad – skriv under du också.</p>
              </>
            ) : (
              <>
                <span className="vote-widget-label">{campaign.headline}</span>
                <p className="vote-widget-text">{campaign.blurb}</p>
              </>
            )}
            <CampaignLink campaign={campaign} className="vote-widget-btn" tabIndex={mobileOpen ? 0 : -1} />
          </div>
        )}
      </nav>
    </>
  )
}
