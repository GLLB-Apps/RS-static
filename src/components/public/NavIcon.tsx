// Small line-art icons for the mobile navigation drawer, keyed by route path.
import type { JSX } from 'react'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const icons: Record<string, JSX.Element> = {
  '/bakgrund': <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  '/amnen': <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  '/nyheter': <><path d="M4 5h12v14H5a1 1 0 0 1-1-1V5z" /><path d="M16 8h3v9a2 2 0 0 1-2 2" /><path d="M7 8h6M7 11h6M7 14h4" /></>,
  '/karta': <><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>,
  '/tidslinje': <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  '/dokument': <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v4h4" /><path d="M9 13h6M9 17h6" /></>,
  '/media': <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 17l-5-5-9 8" /></>,
  '/vittnesmal': <><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.4A8 8 0 1 1 21 12z" /></>,
  '/fragor-och-svar': <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.1 1-1.1 1.8" /><path d="M12 17h.01" /></>,
  '/kontakt': <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
}

const fallback = <path d="M9 6l6 6-6 6" />

export default function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="nav-drawer-icon" {...S} aria-hidden="true">
      {icons[path] ?? fallback}
    </svg>
  )
}
