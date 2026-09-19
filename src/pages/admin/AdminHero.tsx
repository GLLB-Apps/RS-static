import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SiteSettings, HeroButton } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { getCampaign } from '../../lib/campaign'
import { MENU_PAGES } from '../../lib/pages'

// Interna /-länkar får svenska tecken utbytta (å/ä→a, ö→o); externa lämnas.
const convertLink = (v: string) =>
  /^https?:/i.test(v) ? v : v.replace(/[åä]/gi, 'a').replace(/ö/gi, 'o')

const blankButton = (): HeroButton => ({ label: '', url: '', style: 'secondary' })

// Standarduppsättningen som heron alltid haft – visas i editorn tills egna
// knappar sparats, så de går att redigera i stället för att försvinna.
const DEFAULT_HERO_BUTTONS: HeroButton[] = [
  { label: 'Läs om planerna', url: '/amnen', style: 'primary' },
  { label: '', url: '', style: 'secondary', cta: true },
  { label: 'Se området på karta', url: '/karta', style: 'secondary' },
]

export default function AdminHero() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [buttons, setButtons] = useState<HeroButton[]>([])
  const [pageOptions, setPageOptions] = useState<{ group: string; label: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    Promise.all([
      supabase.from('site_settings').select('*').maybeSingle(),
      supabase.from('custom_pages').select('*').eq('status', 'published').order('sort_order'),
    ]).then(([s0, custom]) => {
      const s = s0.data as SiteSettings | null
      setSettings(s)
      setButtons(Array.isArray(s?.hero_buttons) && s!.hero_buttons.length ? s!.hero_buttons : DEFAULT_HERO_BUTTONS)
      const customOpts = (custom.data as { title: string; slug: string }[] ?? []).map(p => ({ group: 'Fristående sidor', label: p.title, url: `/${p.slug}` }))
      setPageOptions([...MENU_PAGES.map(p => ({ group: 'Sidor', label: p.label, url: p.url })), ...customOpts])
      setLoading(false)
    })
  }, [])

  const knownUrls = new Set(pageOptions.map(o => o.url))
  const groups = Array.from(new Set(pageOptions.map(o => o.group)))

  function update(key: 'hero_title' | 'hero_intro' | 'hero_image', value: string | null) {
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev))
  }
  function setButton(i: number, patch: Partial<HeroButton>) {
    setButtons(prev => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  }
  function moveButton(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= buttons.length) return
    setButtons(prev => { const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n })
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    // Töm text/länk på CTA-knappar — de styrs av kampanjläget.
    const clean = buttons.map(b => (b.cta ? { ...b, label: '', url: '' } : b))
    const { error } = await supabase.from('site_settings').update({
      hero_title: settings.hero_title,
      hero_intro: settings.hero_intro,
      hero_image: settings.hero_image,
      hero_buttons: clean,
    }).eq('id', settings.id)
    setSaving(false)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else show('Hero sparad', 'success')
  }

  if (loading || !settings) return <div className="loading"><div className="spinner"></div></div>

  const campaign = getCampaign(settings)

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Hero (startsidans topp)</h1>
        <div className="admin-table-actions">
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Visa startsidan →</a>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
        </div>
      </div>

      <div className="admin-form-card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Text & bild</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="hero_title">Rubrik</label>
          <input id="hero_title" className="form-input" type="text" value={settings.hero_title} onChange={e => update('hero_title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="hero_intro">Ingress</label>
          <textarea id="hero_intro" className="form-textarea" rows={5} value={settings.hero_intro} onChange={e => update('hero_intro', e.target.value)} />
          <p className="form-hint">Tom rad ger ett nytt stycke.</p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="hero_image">Bakgrundsbild (URL)</label>
          <input id="hero_image" className="form-input" type="url" value={settings.hero_image ?? ''} onChange={e => update('hero_image', e.target.value || null)} placeholder="Klistra in bildadress" />
          {settings.hero_image && <img src={settings.hero_image} alt="" className="tap-image-preview" style={{ marginTop: 'var(--space-2)' }} />}
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Knappar</h3>
        <p className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>
          Knapparna visas under rubriken. En knapp kan sättas till <strong>Kampanj-CTA</strong> – då följer text och länk
          automatiskt kampanjläget (namninsamling, donation eller samråd; just nu:{' '}
          {campaign ? `"${campaign.ctaLabel}"` : 'kampanjläget är satt till "Ingenting" — en Kampanj-CTA-knapp visas då inte alls'}).
        </p>

        {buttons.length === 0 && (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Inga knappar än. Utan knappar visas standarduppsättningen.</p>
        )}

        <div className="hero-btn-list">
          {buttons.map((b, i) => (
            <div key={i} className="hero-btn-row">
              <div className="hero-btn-reorder">
                <button type="button" className="menu-icon-btn" onClick={() => moveButton(i, -1)} disabled={i === 0} aria-label="Flytta upp">↑</button>
                <button type="button" className="menu-icon-btn" onClick={() => moveButton(i, 1)} disabled={i === buttons.length - 1} aria-label="Flytta ner">↓</button>
              </div>
              <div className="hero-btn-fields">
                {b.cta ? (
                  <div className="hero-btn-cta-note">
                    {campaign
                      ? <>Kampanj-CTA – text &amp; länk styrs av kampanjläget ("{campaign.ctaLabel}" → {campaign.ctaUrl})</>
                      : <>Kampanj-CTA – kampanjläget är satt till "Ingenting", så den här knappen visas inte alls just nu</>}
                  </div>
                ) : (
                  <>
                    <input className="form-input" type="text" value={b.label} onChange={e => setButton(i, { label: e.target.value })} placeholder="Knapptext" />
                    <div className="hero-btn-linkrow">
                      <select
                        className="form-select"
                        value={knownUrls.has(b.url) ? b.url : ''}
                        onChange={e => e.target.value && setButton(i, { url: e.target.value })}
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
                        value={b.url}
                        onChange={e => setButton(i, { url: convertLink(e.target.value) })}
                        placeholder="…eller egen länk (/sida eller https://…)"
                      />
                    </div>
                  </>
                )}
                <div className="hero-btn-opts">
                  <select className="form-select" value={b.style} onChange={e => setButton(i, { style: e.target.value as HeroButton['style'] })}>
                    <option value="primary">Primär (fylld)</option>
                    <option value="secondary">Sekundär</option>
                  </select>
                  <label className="hero-btn-check">
                    <input type="checkbox" checked={!!b.cta} onChange={e => setButton(i, { cta: e.target.checked })} />
                    Kampanj-CTA
                  </label>
                </div>
              </div>
              <button type="button" className="menu-icon-btn danger" onClick={() => setButtons(prev => prev.filter((_, j) => j !== i))} aria-label="Ta bort knapp">✕</button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={() => setButtons(prev => [...prev, blankButton()])}>
          + Lägg till knapp
        </button>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Link to="/admin/inställningar" className="btn btn-ghost btn-sm">← Webbplatsinställningar</Link>
      </div>
    </div>
  )
}
