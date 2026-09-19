import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ImportantDate, SiteSettings } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { MAIL_DIALOG_DEFAULTS } from '../../lib/campaign'
import { formatDate, todayIso, upcomingDates } from '../../lib/utils'

const BLOB_MODES: { value: NonNullable<SiteSettings['blob_avatars']>; label: string; desc: string }[] = [
  { value: 'off', label: 'Av', desc: 'Inga Rögleblobbar någonstans — vanliga platshållarikoner i stället.' },
  { value: 'admin', label: 'Bara adminpanelen', desc: 'Syns i adminpanelen och intranätet, men inte på den publika sajten.' },
  { value: 'everywhere', label: 'Överallt', desc: 'Syns även publikt: vittnesmål, startsidan, kontaktsidan, kartan.' },
]

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    supabase.from('site_settings').select('*').maybeSingle().then(({ data }) => {
      const s = data as SiteSettings | null
      if (s) {
        // Listan ersätter det gamla enskilda datumfältet. Finns bara det gamla
        // värdet flyttas det in som första rad, så inget tappas bort.
        if (!Array.isArray(s.important_dates)) s.important_dates = []
        if (s.important_dates.length === 0 && s.next_important_date) {
          s.important_dates = [{ date: s.next_important_date, label: '' }]
        }
      }
      setSettings(s)
      setLoading(false)
    })
  }, [])

  function update(key: keyof SiteSettings, value: string | number | Record<string, string> | null) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function updateDates(fn: (prev: ImportantDate[]) => ImportantDate[]) {
    setSettings(prev => prev ? { ...prev, important_dates: fn(prev.important_dates ?? []) } : prev)
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    // Tomma rader tas bort och datumen sorteras, så listan är städad när den sparas.
    const sortedDates = (settings.important_dates ?? [])
      .filter(d => d.date)
      .sort((a, b) => a.date.localeCompare(b.date))
    const { error } = await supabase.from('site_settings').update({
      site_name: settings.site_name,
      site_subtitle: settings.site_subtitle,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      petition_url: settings.petition_url,
      campaign_mode: settings.campaign_mode,
      donate_url: settings.donate_url,
      donate_title: settings.donate_title,
      donate_text: settings.donate_text,
      donate_button: settings.donate_button,
      consult_url: settings.consult_url,
      consult_title: settings.consult_title,
      consult_text: settings.consult_text,
      consult_button: settings.consult_button,
      consult_subject: settings.consult_subject,
      default_share_image: settings.default_share_image,
      contact_email: settings.contact_email,
      contact_phone: settings.contact_phone,
      contact_delivery: settings.contact_delivery ?? 'system',
      contact_recipient: settings.contact_recipient,
      contact_from: settings.contact_from,
      social_links: settings.social_links,
      footer_text: settings.footer_text,
      privacy_text: settings.privacy_text,
      cookie_text: settings.cookie_text,
      status_message: settings.status_message,
      status_phase: settings.status_phase,
      blob_avatars: settings.blob_avatars ?? 'everywhere',
      important_dates: sortedDates,
      // Speglar det närmast kommande datumet, så att äldre läsare av fältet
      // fortsätter visa rätt sak.
      next_important_date: upcomingDates(sortedDates)[0]?.date ?? null,
      consult_dialog_title: settings.consult_dialog_title,
      consult_dialog_text: settings.consult_dialog_text,
      consult_dialog_note: settings.consult_dialog_note,
      consult_dialog_confirm: settings.consult_dialog_confirm,
      consult_dialog_cancel: settings.consult_dialog_cancel,
      signature_count: settings.signature_count,
    }).eq('id', settings.id)
    setSaving(false)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else show('Inställningar sparade', 'success')
  }

  async function syncSignatures() {
    try {
      const r = await fetch('/api/sync-signatures')
      const j = await r.json()
      if (r.ok && typeof j.count === 'number') {
        update('signature_count', j.count)
        show(`Hämtade ${j.count} underskrifter från Skrivunder`, 'success')
      } else {
        show('Kunde inte hämta: ' + (j.error ?? r.status), 'error')
      }
    } catch {
      show('Kunde inte hämta (fungerar bara i den publicerade versionen)', 'error')
    }
  }

  if (loading || !settings) return <div className="loading"><div className="spinner"></div></div>

  const dates = settings.important_dates ?? []
  const upcoming = upcomingDates(dates)
  const today = todayIso()

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Webbplatsinställningar</h1>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
      </div>

      <div className="admin-form-card">
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Allmänt</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="site_name">Webbplatsens namn</label>
          <input id="site_name" className="form-input" type="text" value={settings.site_name} onChange={e => update('site_name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="site_subtitle">Undertitel</label>
          <input id="site_subtitle" className="form-input" type="text" value={settings.site_subtitle} onChange={e => update('site_subtitle', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="logo_url">Logotyp (URL)</label>
            <input id="logo_url" className="form-input" type="url" value={settings.logo_url ?? ''} onChange={e => update('logo_url', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="favicon_url">Favicon (URL)</label>
            <input id="favicon_url" className="form-input" type="url" value={settings.favicon_url ?? ''} onChange={e => update('favicon_url', e.target.value || null)} />
          </div>
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Rögleblobbar</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
          Styr var de interaktiva avatar-figurerna syns — vittnesmål, kontosidor, startsidans teaser m.m.
        </p>
        <div className="form-group">
          <div className="segmented-switch" role="radiogroup" aria-label="Rögleblobbar">
            {BLOB_MODES.map(m => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={(settings.blob_avatars ?? 'everywhere') === m.value}
                className={`segmented-switch-option${(settings.blob_avatars ?? 'everywhere') === m.value ? ' is-active' : ''}`}
                onClick={() => update('blob_avatars', m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
            {BLOB_MODES.find(m => m.value === (settings.blob_avatars ?? 'everywhere'))?.desc}
          </p>
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Startsidans hero</h3>
        <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>Rubrik, ingress, bild och knappar/CTA redigeras i hero-editorn.</p>
        <Link to="/admin/hero" className="btn btn-secondary btn-sm">Redigera hero →</Link>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Startsidans texter och block</h3>
        <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>
          Rubrikerna på startsidan och de tre blocken under sammanfattningen – bland dem
          "Vad händer nu?" – redigeras under Sidor → Startsida.
        </p>
        <Link to="/admin/sidor/hem" className="btn btn-secondary btn-sm">Redigera startsidans texter →</Link>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Aktuell status</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="status_message">Statusmeddelande</label>
          <input id="status_message" className="form-input" type="text" value={settings.status_message ?? ''} onChange={e => update('status_message', e.target.value || null)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="status_phase">Aktuell fas</label>
          <input id="status_phase" className="form-input" type="text" value={settings.status_phase ?? ''} onChange={e => update('status_phase', e.target.value || null)} />
        </div>
        <div className="form-group">
          <span className="form-label">Viktiga datum</span>
          <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>
            Lägg in alla kommande datum du känner till. Startsidan visar det närmast kommande under
            "Nästa viktiga datum" och går vidare till nästa av sig själv när dagen passerat – passerade
            datum ligger kvar här men visas inte.
          </p>
          {dates.length === 0 && (
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>Inga datum inlagda ännu.</p>
          )}
          {dates.map((d, i) => {
            const passed = !!d.date && d.date < today
            return (
              <div className="important-date-row" key={i}>
                <input
                  className="form-input important-date-day"
                  type="date"
                  value={d.date ?? ''}
                  aria-label="Datum"
                  onChange={e => updateDates(prev => prev.map((x, xi) => xi === i ? { ...x, date: e.target.value } : x))}
                />
                <input
                  className="form-input"
                  type="text"
                  maxLength={120}
                  placeholder="Vad händer? T.ex. Samrådet stänger"
                  value={d.label ?? ''}
                  aria-label="Vad datumet gäller"
                  onChange={e => updateDates(prev => prev.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))}
                />
                {passed && <span className="badge badge-muted important-date-badge">Passerat</span>}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label="Ta bort datum"
                  onClick={() => updateDates(prev => prev.filter((_, xi) => xi !== i))}
                >
                  Ta bort
                </button>
              </div>
            )
          })}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 'var(--space-2)' }}
            onClick={() => updateDates(prev => [...prev, { date: '', label: '' }])}
          >
            + Lägg till datum
          </button>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-3)', marginBottom: 0 }}>
            {upcoming.length > 0
              ? <>Visas just nu: <strong>{formatDate(upcoming[0].date)}</strong>{upcoming[0].label ? ` – ${upcoming[0].label}` : ''}{upcoming.length > 1 ? ` (${upcoming.length - 1} till på kö)` : ''}</>
              : 'Inget kommande datum – startsidan visar "Ännu ej fastställt".'}
          </p>
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="signature_count">Antal underskrifter</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input id="signature_count" className="form-input" type="number" value={settings.signature_count} onChange={e => update('signature_count', Number(e.target.value))} />
              <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={syncSignatures}>Hämta från Skrivunder</button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
              Hämtas automatiskt en gång per dygn från kampanjsidan. Knappen uppdaterar direkt (fungerar i den publicerade versionen).
            </p>
          </div>
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Kampanjläge</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
          Styr webbplatsens uppmaningar. <strong>Namninsamling</strong> visar underskrifter och "Skriv under".
          <strong> Donera</strong> döljer namninsamlingsdelarna och visar ett donationsflöde i stället.
          <strong> Mejla samrådet</strong> öppnar besökarens eget mejlprogram med NCC:s samrådsadress ifylld,
          efter en ruta som förklarar vad som händer.
          <strong> Ingenting</strong> tar bort uppmaningen helt — ingen knapp, ingen flytande widget,
          inget CTA-band i sidfoten.
          Går att växla fram och tillbaka.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="campaign_mode">Läge</label>
          <select
            id="campaign_mode"
            className="form-select"
            value={settings.campaign_mode ?? 'petition'}
            onChange={e => update('campaign_mode', e.target.value)}
          >
            <option value="petition">Namninsamling (underskrifter)</option>
            <option value="donate">Donera</option>
            <option value="consult">Mejla samrådet (kontaktsidan)</option>
            <option value="none">Ingenting (ingen knapp)</option>
          </select>
        </div>
        {settings.campaign_mode === 'consult' ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="consult_url">Mottagaradress (e-post)</label>
              <input id="consult_url" className="form-input" type="email" maxLength={255} placeholder="samrad.sodrasandby@ncc.se" value={settings.consult_url ?? ''} onChange={e => update('consult_url', e.target.value || null)} />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
                Knappen visar först en ruta som förklarar vad som händer, och öppnar sedan besökarens eget
                mejlprogram med den här adressen och ämnesraden ifyllda. Mejlet skickas av besökaren själv och
                passerar aldrig webbplatsen. Lämnas tom = <code>samrad.sodrasandby@ncc.se</code>.
              </p>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="consult_title">Rubrik</label>
                <input id="consult_title" className="form-input" type="text" maxLength={255} placeholder="Säg din mening i samrådet" value={settings.consult_title ?? ''} onChange={e => update('consult_title', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="consult_button">Knapptext</label>
                <input id="consult_button" className="form-input" type="text" maxLength={100} placeholder="Mejla samrådet" value={settings.consult_button ?? ''} onChange={e => update('consult_button', e.target.value || null)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="consult_text">Kort text</label>
              <textarea id="consult_text" className="form-textarea" rows={2} maxLength={1000} placeholder="Under samrådet kan du lämna synpunkter på planerna för Rögleskogen." value={settings.consult_text ?? ''} onChange={e => update('consult_text', e.target.value || null)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="consult_subject">Ämnesrad i mejlet</label>
              <input id="consult_subject" className="form-input" type="text" maxLength={255} placeholder="Synpunkt inför samrådet – Rögleskogen" value={settings.consult_subject ?? ''} onChange={e => update('consult_subject', e.target.value || null)} />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
                Fylls i åt besökaren och går att ändra innan mejlet skickas.
              </p>
            </div>

            <h4 style={{ margin: 'var(--space-5) 0 var(--space-2)', fontSize: '0.95rem' }}>Rutan innan mejlprogrammet öppnas</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Mellanlandningen som förklarar att besökaren skickar mejlet själv, från sitt eget program.
              Mottagaradressen och ämnesraden visas alltid i rutan och behöver inte upprepas i texten.
              Lämna ett fält tomt så används standardtexten som står som exempel.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="consult_dialog_title">Rubrik i rutan</label>
              <input id="consult_dialog_title" className="form-input" type="text" maxLength={160} placeholder={MAIL_DIALOG_DEFAULTS.title} value={settings.consult_dialog_title ?? ''} onChange={e => update('consult_dialog_title', e.target.value || null)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="consult_dialog_text">Förklarande text</label>
              <textarea id="consult_dialog_text" className="form-textarea" rows={4} maxLength={1000} placeholder={MAIL_DIALOG_DEFAULTS.text} value={settings.consult_dialog_text ?? ''} onChange={e => update('consult_dialog_text', e.target.value || null)} />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="consult_dialog_confirm">Knapp: gå vidare</label>
                <input id="consult_dialog_confirm" className="form-input" type="text" maxLength={80} placeholder={MAIL_DIALOG_DEFAULTS.confirm} value={settings.consult_dialog_confirm ?? ''} onChange={e => update('consult_dialog_confirm', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="consult_dialog_cancel">Knapp: avbryt</label>
                <input id="consult_dialog_cancel" className="form-input" type="text" maxLength={80} placeholder={MAIL_DIALOG_DEFAULTS.cancel} value={settings.consult_dialog_cancel ?? ''} onChange={e => update('consult_dialog_cancel', e.target.value || null)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="consult_dialog_note">Fotnot</label>
              <textarea id="consult_dialog_note" className="form-textarea" rows={3} maxLength={600} placeholder={MAIL_DIALOG_DEFAULTS.note} value={settings.consult_dialog_note ?? ''} onChange={e => update('consult_dialog_note', e.target.value || null)} />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
                Står längst ned i rutan – tänkt för den vars dator saknar mejlprogram.
              </p>
            </div>
          </>
        ) : settings.campaign_mode === 'donate' ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="donate_url">Länk till donation</label>
              <input id="donate_url" className="form-input" type="url" placeholder="https://…" value={settings.donate_url ?? ''} onChange={e => update('donate_url', e.target.value || null)} />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="donate_title">Rubrik</label>
                <input id="donate_title" className="form-input" type="text" placeholder="Stöd initiativet" value={settings.donate_title ?? ''} onChange={e => update('donate_title', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="donate_button">Knapptext</label>
                <input id="donate_button" className="form-input" type="text" placeholder="Donera" value={settings.donate_button ?? ''} onChange={e => update('donate_button', e.target.value || null)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="donate_text">Kort text</label>
              <textarea id="donate_text" className="form-textarea" rows={2} placeholder="Ditt bidrag hjälper oss att bevaka planerna och nå ut med information." value={settings.donate_text ?? ''} onChange={e => update('donate_text', e.target.value || null)} />
            </div>
          </>
        ) : (
          <p className="text-muted" style={{ fontSize: '0.82rem' }}>
            Inställningar för länk, rubrik och text visas här när du väljer läget <strong>Donera</strong> eller
            <strong> Mejla samrådet</strong>.
          </p>
        )}
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Kontakt och länkar</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="petition_url">Länk till namninsamling</label>
          <input id="petition_url" className="form-input" type="url" value={settings.petition_url} onChange={e => update('petition_url', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="contact_email">Kontakt-e-post</label>
            <input id="contact_email" className="form-input" type="email" value={settings.contact_email ?? ''} onChange={e => update('contact_email', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="contact_phone">Kontakt-telefon</label>
            <input id="contact_phone" className="form-input" type="tel" value={settings.contact_phone ?? ''} onChange={e => update('contact_phone', e.target.value || null)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="default_share_image">Standardbild för delning (URL)</label>
          <input id="default_share_image" className="form-input" type="url" value={settings.default_share_image ?? ''} onChange={e => update('default_share_image', e.target.value || null)} />
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Kontaktformulär – mottagning</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
          Välj hur meddelanden från kontaktformuläret tas emot. <strong>System</strong> sparar dem under
          Meddelanden i adminpanelen. <strong>E-post</strong> skickar dem vidare via Resend till mottagaradressen.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="contact_delivery">Ta emot som</label>
          <select
            id="contact_delivery"
            className="form-select"
            value={settings.contact_delivery ?? 'system'}
            onChange={e => update('contact_delivery', e.target.value)}
          >
            <option value="system">System (adminpanelen)</option>
            <option value="email">E-post</option>
            <option value="both">Både system och e-post</option>
          </select>
        </div>
        {(settings.contact_delivery === 'email' || settings.contact_delivery === 'both') && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="contact_recipient">Mottagar-e-post</label>
              <input id="contact_recipient" className="form-input" type="email" placeholder={settings.contact_email ?? 'namn@exempel.se'} value={settings.contact_recipient ?? ''} onChange={e => update('contact_recipient', e.target.value || null)} />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>Dit meddelandena mejlas. Lämnas tom = kontakt-e-posten ovan.</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact_from">Avsändaradress (Resend)</label>
              <input id="contact_from" className="form-input" type="text" placeholder="Kontaktformulär <onboarding@resend.dev>" value={settings.contact_from ?? ''} onChange={e => update('contact_from', e.target.value || null)} />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
                Kräver en verifierad domän i Resend. Lämnas tom används testadressen <code>onboarding@resend.dev</code>
                (kan bara mejla till Resend-kontots egen adress). API-nyckeln <code>RESEND_API_KEY</code> sätts som miljövariabel i Vercel.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Texter</h3>
        <div className="form-group">
          <span className="form-label">Sidfot</span>
          <p className="form-hint" style={{ marginBottom: 'var(--space-2)' }}>
            Sidfotens texter, länkar och raden längst ned redigeras i sin egen vy.
          </p>
          <Link to="/admin/sidfot" className="btn btn-secondary btn-sm">Redigera sidfoten →</Link>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="privacy_text">Integritetstext</label>
          <textarea id="privacy_text" className="form-textarea" rows={3} value={settings.privacy_text ?? ''} onChange={e => update('privacy_text', e.target.value || null)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cookie_text">Cookie-information</label>
          <textarea id="cookie_text" className="form-textarea" rows={2} value={settings.cookie_text ?? ''} onChange={e => update('cookie_text', e.target.value || null)} />
        </div>
      </div>

      <div className="admin-form-actions" style={{ marginTop: 'var(--space-5)' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara alla inställningar'}</button>
      </div>
    </div>
  )
}
