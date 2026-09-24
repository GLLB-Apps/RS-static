import { useEffect, useState } from 'react'
import type { Sponsor } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { usePage } from '../../lib/usePage'

// A single-row, continuously scrolling ticker of sponsor logos. About four are
// visible at a time; the rest scroll into view. Pauses on hover/focus.
export default function SponsorTicker() {
  const page = usePage('hem')
  const [sponsors, setSponsors] = useState<Sponsor[]>([])

  useEffect(() => {
    supabase.from('sponsors').select('*').then(({ data }) => {
      const list = (data as Sponsor[] ?? [])
        .filter(s => s.is_active && s.image_url)
        .sort((a, b) => a.sort_order - b.sort_order)
      setSponsors(list)
    })
  }, [])

  if (sponsors.length === 0) return null

  // Repeat so one "set" is wide enough to fill the row, then duplicate the set
  // for a seamless -50% loop.
  const base: Sponsor[] = []
  while (base.length < Math.max(sponsors.length, 8)) base.push(...sponsors)
  const items = [...base, ...base]
  const duration = base.length * 3.5

  return (
    <section className="section sponsor-section">
      <div className="container">
        <h2 className="sponsor-heading">{page.text('sponsors_heading')}</h2>
        <div className="sponsor-ticker">
          <div className="sponsor-track" style={{ animationDuration: `${duration}s` }}>
            {items.map((s, i) => {
              const img = <img src={s.image_url!} alt={s.name} loading="lazy" />
              return (
                <div className="sponsor-item" key={i} aria-hidden={i >= base.length}>
                  {s.link_url
                    ? <a href={s.link_url} target="_blank" rel="noopener noreferrer" data-tooltip={s.name}>{img}</a>
                    : img}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
