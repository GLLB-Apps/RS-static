import { useRef, useState } from 'react'
import { usePage } from '../../lib/usePage'
import Dropzone from '../admin/Dropzone'
import MapPicker from './MapPicker'
import UserAvatar from '../UserAvatar'
import { randomRogleTitle } from '../../lib/rogleTitles'
import { testimonyBlobSeed } from '../../lib/utils'

interface TestimonyFormProps {
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  /** Förifyllt namn, t.ex. från startsidans teaser — samma figur följer med hit. */
  initialName?: string
  /** Den slumpade titeln från startsidans teaser ("Röglehjälte" osv), så det är samma ord genom hela flödet. Slumpas fram lokalt om den saknas (t.ex. vid direktbesök på sidan). */
  initialTitleWord?: string
}

// Tre steg: berättelsen (där figuren skapas), om dig, och bild/plats/kontakt.
// Figuren följer insättningspunkten ("writing") på de två sista stegen — inte
// på det första, där den bara visas fram allteftersom berättelsen skrivs.
const STEPS = [
  { label: 'Din berättelse' },
  { label: 'Om dig' },
  { label: 'Bild, plats & kontakt' },
]

export default function TestimonyForm({ onSubmit, initialName = '', initialTitleWord = '' }: TestimonyFormProps) {
  const page = usePage('vittnesmal')
  // Ordet som beskriver figuren i texten runt den — "Röglehjälte", "Röglevän"
  // osv. Kommer med från startsidans teaser om man klickade sig hit därifrån,
  // annars slumpas ett eget (en gång, inte per rendering).
  const [rogleWord] = useState(() => initialTitleWord || randomRogleTitle())
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showMap, setShowMap] = useState(false)
  const [form, setForm] = useState({
    title: '',
    story: '',
    author_name: initialName,
    is_anonymous: false,
    email: '',
    location: '',
    area_usage: '',
    featured_image: '',
    map_lat: null as number | null,
    map_lng: null as number | null,
    consent_publish: false,
    consent_contact: false,
    consent_marketing: false,
    website: '',
  })
  const locationRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  function validateStory(): boolean {
    if (!form.story.trim()) { setErrors({ story: 'Berättelse är obligatorisk' }); return false }
    setErrors({})
    return true
  }

  function validateFinal(): boolean {
    const e: Record<string, string> = {}
    if (!form.story.trim()) e.story = 'Berättelse är obligatorisk'
    if (!form.email.trim()) e.email = 'E-post är obligatorisk'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ogiltig e-postadress'
    if (!form.consent_publish) e.consent_publish = 'Du måste godkänna behandling och publicering'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (step === 0 && !validateStory()) return
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  function back() {
    setStep(s => Math.max(s - 1, 0))
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (form.website) return
    if (!validateFinal()) { setStep(!form.story.trim() ? 0 : 2); return }
    setSubmitting(true)
    await onSubmit(form)
    setSubmitting(false)
    setForm({
      title: '', story: '', author_name: initialName, is_anonymous: false, email: '', location: '', area_usage: '',
      featured_image: '', map_lat: null, map_lng: null,
      consent_publish: false, consent_contact: false, consent_marketing: false, website: '',
    })
    setShowMap(false)
    setStep(0)
  }

  function update(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <div className="testimony-form-avatar-preview">
        {/* Namn och berättelse bor båda i steg 1 nu, så det är där figuren
            skapas — och bara där. Formen står sedan fast på steg 2–3, för
            inget av fälten där (ort, e-post) rör vid fröet. */}
        <UserAvatar
          seed={testimonyBlobSeed(form.author_name, form.story, form.is_anonymous)}
          size={88}
          gaze={step === 0}
          caretOf={step === 1 ? locationRef : step === 2 ? emailRef : undefined}
          title={step === 0 ? `Din ${rogleWord}` : 'Ändras medan du skriver'}
        />
        <p className="form-hint" style={{ margin: 0 }}>
          {step === 0
            ? `Din ${rogleWord} skapas av ditt namn och din berättelse.`
            : `Din ${rogleWord} är skapad av ditt namn och din berättelse, och följer med blicken medan du skriver.`}
          {form.is_anonymous && ' Anonymt vittnesmål — figuren speglar inte namnet.'}
        </p>
      </div>

      <div className="testimony-stepper" role="list">
        {STEPS.map((s, i) => (
          <div key={s.label} className={`testimony-stepper-item${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`} role="listitem">
            <span className="testimony-stepper-dot">{i < step ? '✓' : i + 1}</span>
            <span className="testimony-stepper-label">{s.label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="author_name">{page.text('label_name')}</label>
            <input id="author_name" className="form-input" type="text" value={form.author_name} onChange={e => update('author_name', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="title">{page.text('label_title')}</label>
            <input id="title" className="form-input" type="text" value={form.title} onChange={e => update('title', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="story">{page.text('label_story')} *</label>
            <textarea id="story" className="form-textarea" rows={6} value={form.story} onChange={e => update('story', e.target.value)} aria-invalid={!!errors.story} />
            {errors.story && <p className="form-error">{errors.story}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="area_usage">{page.text('label_area')}</label>
            <input id="area_usage" className="form-input" type="text" placeholder="T.ex. promenader, hundrastning, naturupplevelser" value={form.area_usage} onChange={e => update('area_usage', e.target.value)} />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="location">{page.text('label_location')}</label>
            <input ref={locationRef} id="location" className="form-input" type="text" placeholder="T.ex. Södra Sandby" value={form.location} onChange={e => update('location', e.target.value)} />
          </div>

          <div className="checkbox-group">
            <input id="is_anonymous" type="checkbox" checked={form.is_anonymous} onChange={e => update('is_anonymous', e.target.checked)} />
            <label htmlFor="is_anonymous" className="form-label" style={{ margin: 0 }}>
              {page.text('anonymous')}
            </label>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {/* Image */}
          <div className="form-group">
            <label className="form-label">Bild (valfritt)</label>
            {form.featured_image ? (
              <div className="testimony-image-preview">
                <img src={form.featured_image} alt="" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { update('featured_image', ''); update('consent_marketing', false) }}>Ta bort bild</button>
              </div>
            ) : (
              <Dropzone
                compact
                label="Dra och släpp en bild här"
                hint="eller klicka för att välja / ta ett foto"
                onUploaded={url => update('featured_image', url)}
                onError={m => setErrors(e => ({ ...e, image: m }))}
              />
            )}
            {errors.image && <p className="form-error">{errors.image}</p>}
          </div>

          {form.featured_image && (
            <div className="checkbox-group">
              <input id="consent_marketing" type="checkbox" checked={form.consent_marketing} onChange={e => update('consent_marketing', e.target.checked)} />
              <label htmlFor="consent_marketing" className="form-label" style={{ margin: 0 }}>
                Jag godkänner att bilden får användas i initiativets marknadsföring
              </label>
            </div>
          )}

          {/* Map location */}
          <div className="checkbox-group">
            <input
              id="show_map"
              type="checkbox"
              checked={showMap}
              onChange={e => { setShowMap(e.target.checked); if (!e.target.checked) setForm(p => ({ ...p, map_lat: null, map_lng: null })) }}
            />
            <label htmlFor="show_map" className="form-label" style={{ margin: 0 }}>Jag vill markera var det hände på kartan</label>
          </div>

          {showMap && (
            <div className="form-group testimony-map-reveal">
              <p className="form-hint">Klicka på kartan för att sätta en markering (dra i kartan för att flytta).</p>
              <MapPicker lat={form.map_lat} lng={form.map_lng} onChange={(la, ln) => setForm(p => ({ ...p, map_lat: la, map_lng: ln }))} />
              {form.map_lat != null && form.map_lng != null && (
                <div className="testimony-map-chosen">
                  <span className="form-hint">Vald plats: {form.map_lat.toFixed(4)}, {form.map_lng.toFixed(4)}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, map_lat: null, map_lng: null }))}>Rensa markering</button>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">{page.text('label_email')} *</label>
            <input ref={emailRef} id="email" className="form-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} aria-invalid={!!errors.email} />
            {errors.email ? <p className="form-error">{errors.email}</p> : <p className="form-hint">{page.text('email_hint')}</p>}
          </div>

          <div className="checkbox-group">
            <input id="consent_publish" type="checkbox" checked={form.consent_publish} onChange={e => update('consent_publish', e.target.checked)} aria-invalid={!!errors.consent_publish} />
            <label htmlFor="consent_publish" className="form-label" style={{ margin: 0 }}>
              {page.text('consent_publish')} *
            </label>
          </div>
          {errors.consent_publish && <p className="form-error">{errors.consent_publish}</p>}

          <div className="checkbox-group">
            <input id="consent_contact" type="checkbox" checked={form.consent_contact} onChange={e => update('consent_contact', e.target.checked)} />
            <label htmlFor="consent_contact" className="form-label" style={{ margin: 0 }}>
              {page.text('consent_contact')}
            </label>
          </div>

          <p className="form-hint" style={{ marginTop: 'var(--space-4)' }}>
            {page.text('review_hint')}
          </p>
        </>
      )}

      {/* Honeypot */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor="website">Lämna tomt</label>
        <input id="website" type="text" value={form.website} onChange={e => update('website', e.target.value)} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="testimony-stepper-actions">
        {step > 0 && <button type="button" className="btn btn-ghost" onClick={back}>Tillbaka</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={next}>Nästa</button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Skickar…' : page.text('submit')}
          </button>
        )}
      </div>
    </form>
  )
}
