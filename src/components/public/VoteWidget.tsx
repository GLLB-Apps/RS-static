import { useState } from 'react'
import type { SiteSettings } from '../../lib/types'
import { getCampaign } from '../../lib/campaign'
import CampaignLink from './CampaignLink'
import CountUp from './CountUp'

const iconProps = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8',
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const

function Bullhorn() {
  return (
    <svg {...iconProps}>
      <path d="M3 11l13-5v12L3 13z" />
      <path d="M16 8.5a4 4 0 0 1 0 7" />
      <path d="M6 13.2V17a2 2 0 0 0 3.9.6" />
    </svg>
  )
}

function Envelope() {
  return (
    <svg {...iconProps}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5l9 6 9-6" />
    </svg>
  )
}

// Floating call-to-action (desktop): live signature count + a "sign" button.
// Can be folded into a small tab at the screen edge and slid back out — en
// megafon, eller ett kuvert när CTA:n leder till samrådets kontaktformulär.
export default function VoteWidget({ settings }: { settings: SiteSettings | null }) {
  // Start folded (just the bullhorn tab) on small screens so it doesn't cover content.
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  const count = settings?.signature_count ?? 0
  const c = getCampaign(settings)
  if (!c) return null
  const asideLabel = c.shortLabel

  return (
    <>
      <aside className={collapsed ? 'vote-widget is-collapsed' : 'vote-widget'} aria-label={asideLabel} aria-hidden={collapsed}>
        <button className="vote-widget-fold" onClick={() => setCollapsed(true)} aria-label="Fäll ihop" title="Fäll ihop">›</button>
        {c.showSignatures ? (
          <>
            <span className="vote-widget-label">Underskrifter</span>
            <span className="vote-widget-count"><CountUp value={count} /></span>
          </>
        ) : (
          <span className="vote-widget-label">{c.headline}</span>
        )}
        <p className="vote-widget-text">{c.showSignatures ? 'Var med och gör skillnad – skriv under du också.' : c.blurb}</p>
        <CampaignLink campaign={c} className="vote-widget-btn" />
      </aside>

      <button
        className={collapsed ? 'vote-widget-tab is-visible' : 'vote-widget-tab'}
        onClick={() => setCollapsed(false)}
        aria-label={'Visa ' + asideLabel.toLowerCase()}
        title={asideLabel}
      >
        {c.mode === 'consult' ? <Envelope /> : <Bullhorn />}
      </button>
    </>
  )
}
