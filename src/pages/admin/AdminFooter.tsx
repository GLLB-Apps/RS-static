import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SiteSettings } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { getCampaign } from '../../lib/campaign'
import { MENU_PAGES } from '../../lib/pages'
import {
  DEFAULT_FOOTER_LINKS, FOOTER_CTA_KEY, FOOTER_FIELDS, FOOTER_LINKS_KEY, FOOTER_SLUG,
  fillFooterTokens, serializeFooterLinks, parseFooterLinks, type FooterLink,
} from '../../lib/footer'

// Interna /-länkar får svenska tecken utbytta (å/ä→a, ö→o); externa lämnas.
const convertLink = (v: string) =>
  /^(https?:|mailto:|tel:)/i.test(v) ? v : v.replace(/[åä]/gi, 'a').replace(/ö/gi, 'o')

// Radlistan för länkarna återanvänder heroknapparnas layoutklasser.
export default function AdminFooter() {
  const { show } = useToast()
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<FooterLink[]>([])
  const [showCta, setShowCta] = useState(true)
  const [pageOptions, setPageOptions] = useState<{ group: string; label: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('site_settings').select('*').maybeSingle(),
      supabase.from('pages').select('*').eq('slug', FOOTER_SLUG).maybeSingle(),
      supabase.from('custom_pages').select('*').eq('status', 'published').order('sort_order'),
    ]).then(([s0, p0, custom]) => {
      const s = s0.data as SiteSettings | null
      const saved = (p0.data as { texts?: Record<string, string> } | null)?.texts ?? {}
      setSettings(s)

      const base: Record<string, string> = {}
      for (const f of FOOTER_FIELDS) base[f.key] = saved[f.key] ?? f.default
      // Första gången hämtas märkestexten från den gamla sidfotstexten i
      // webbplatsinställningarna, så inget innehåll tappas.
      if (typeof saved.brand_text !== 'string' && s?.footer_text) base.brand_text = s.footer_text
      setTexts(base)

      setLinks(typeof saved[FOOTER_LINKS_KEY] === 'string' ? parseFooterLinks(saved[FOOTER_LINKS_KEY]) : DEFAULT_FOOTER_LINKS)
      setShowCta(saved[FOOTER_CTA_KEY] !== '0')

      const customOpts = (custom.data as { title: string; slug: string }[] ?? []).map(p => ({ group: 'Fristående sidor', label: p.title, url: `/${p.slug}` }))
      setPageOptions([...MENU_PAGES.map(p => ({ group: 'Sidor', label: p.label, url: p.url })), ...customOpts])
      setLoading(false)
    })
  }, [])

  const knownUrls = new Set(pageOptions.map(o => o.url))
  const groups = Array.from(new Set(pageOptions.map(o => o.group)))

  function setText(key: string, value: string) {
    setTexts(prev => ({ ...prev, [key]: value }))
  }
  function setLink(i: number, patch: Partial<FooterLink>) {
    setLinks(prev => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }
  function moveLink(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= links.length) return
    setLinks(prev => { const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n })
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('pages').upsert({
      id: FOOTER_SLUG,
      slug: FOOTER_SLUG,
      title: 'Sidfot',
      texts: {
        ...texts,
        [FOOTER_LINKS_KEY]: serializeFooterLinks(links),
        [FOOTER_CTA_KEY]: showCta ? '1' : '0',
      },
    })
    setSaving(false)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else show('Sidfoten sparad', 'success')
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const campaign = getCampaign(settings)
  const siteName = settings?.site_name ?? 'Rögleskogen'

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Sidfot</h1>
        <div className="admin-table-actions">
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Visa webbplatsen →</a>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
        </div>
      </div>

      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        Texterna i sidfoten. Tomma fält visas inte alls – vill du bli av med en rad räcker det att tömma den.
        Uppmaningsbandet högst upp i sidfoten styrs av kampanjläget i webbplatsinställningarna.
      </p>

      <div className="admin-form-card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Texter</h3>
        {FOOTER_FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label" htmlFor={`f_${f.key}`}>{f.label}</label>
            {f.multiline ? (
              <textarea id={`f_${f.key}`} className="form-textarea" rows={2} value={texts[f.key] ?? ''} onChange={e => setText(f.key, e.target.value)} />
            ) : (
              <input id={`f_${f.key}`} className="form-input" type="text" value={texts[f.key] ?? ''} onChange={e => setText(f.key, e.target.value)} />
            )}
            {f.hint && <p className="form-hint">{f.hint}</p>}
            {f.key === 'copyright' && (
              <p className="form-hint">
                Visas som: <strong>{fillFooterTokens(texts.copyright ?? '', siteName) || '(döljs)'}</strong>
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Länkar i sidfoten</h3>
        <p className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>
          Länkarna i kolumnen ”{texts.links_heading || 'länkkolumnen'}”.
        </p>

        <label className="hero-btn-check" style={{ marginBottom: 'var(--space-4)' }}>
          <input type="checkbox" checked={showCta} disabled={!campaign} onChange={e => setShowCta(e.target.checked)} />
          {campaign
            ? <>Visa kampanjlänken överst (”{campaign.ctaLabel}” → {campaign.ctaUrl})</>
            : <>Visa kampanjlänken överst (kampanjläget är satt till "Ingenting" i inställningar — ingen länk att visa)</>}
        </label>

        {links.length === 0 && (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Inga länkar. Kolumnen visas bara om den har en rubrik eller kampanjlänken.</p>
        )}

        <div className="hero-btn-list">
          {links.map((l, i) => (
            <div key={i} className="hero-btn-row">
              <div className="hero-btn-reorder">
                <button type="button" className="menu-icon-btn" onClick={() => moveLink(i, -1)} disabled={i === 0} aria-label="Flytta upp">↑</button>
                <button type="button" className="menu-icon-btn" onClick={() => moveLink(i, 1)} disabled={i === links.length - 1} aria-label="Flytta ner">↓</button>
              </div>
              <div className="hero-btn-fields">
                <input className="form-input" type="text" value={l.label} onChange={e => setLink(i, { label: e.target.value })} placeholder="Länktext" />
                <div className="hero-btn-linkrow">
                  <select
                    className="form-select"
                    value={knownUrls.has(l.url) ? l.url : ''}
                    onChange={e => e.target.value && setLink(i, { url: e.target.value, label: l.label || (pageOptions.find(o => o.url === e.target.value)?.label ?? '') })}
                    aria-label="Välj sida"
                  >
                    <option value="">Välj sida…</option>
                    {groups.map(g => (
                      <optgroup key={g} label={g}>
                        {pageOptions.filter(o => o.group === g).map(o => (
                          <option key={o.url} value={o.url}>{o.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    type="text"
                    value={l.url}
                    onChange={e => setLink(i, { url: convertLink(e.target.value) })}
                    placeholder="…eller egen länk (/sida eller https://…)"
                  />
                </div>
              </div>
              <button type="button" className="menu-icon-btn danger" onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))} aria-label="Ta bort länk">✕</button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={() => setLinks(prev => [...prev, { label: '', url: '' }])}>
          + Lägg till länk
        </button>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Hämtas från webbplatsinställningarna</h3>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
          Webbplatsens namn ({siteName}), undertiteln, e-post, telefon, sociala länkar och kampanjbandet
          redigeras i inställningarna.
        </p>
        <Link to="/admin/inställningar" className="btn btn-secondary btn-sm">Webbplatsinställningar →</Link>
      </div>

      <div className="admin-form-actions" style={{ marginTop: 'var(--space-5)' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara sidfoten'}</button>
      </div>
    </div>
  )
}
