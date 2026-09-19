import { useEffect, useState } from 'react'
import type { Contact, SiteSettings } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { usePage } from '../../lib/usePage'
import UserAvatar from '../../components/UserAvatar'

export default function ContactPage() {
  const { settings } = useOutletContext<{ settings: SiteSettings | null }>()
  const page = usePage('kontakt')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // ?amne=… förifyller ämnesraden – används av kampanjlägets samråds-CTA.
  const [params] = useSearchParams()
  const presetSubject = params.get('amne') ?? ''
  const [form, setForm] = useState({
    name: '', email: '', subject: presetSubject, message: '', website: '',
  })

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .eq('is_public', true)
      .order('sort_order')
      .then(({ data }) => {
        setContacts(data as Contact[] ?? [])
        setLoading(false)
      })
  }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Namn är obligatoriskt'
    if (!form.email.trim()) e.email = 'E-post är obligatoriskt'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ogiltig e-postadress'
    if (!form.message.trim()) e.message = 'Meddelande är obligatoriskt'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function done(ok: boolean) {
    if (ok) {
      show(page.text('success'), 'success')
      setForm({ name: '', email: '', subject: presetSubject, message: '', website: '' })
    } else {
      show('Något gick fel. Försök igen senare.', 'error')
    }
  }

  // Sparar direkt i systemet — reserv för miljöer utan serverfunktionen (t.ex.
  // lokal vite-dev). I produktion sköter /api/contact leveransen enligt inställning.
  async function fallbackInsert() {
    const { error } = await supabase.from('contact_messages').insert({
      name: form.name, email: form.email, subject: form.subject, message: form.message, status: 'unread',
    })
    done(!error)
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (form.website) return
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, subject: form.subject, message: form.message, website: form.website }),
      })
      if (res.ok) done(true)
      else if (res.status === 404) await fallbackInsert() // funktionen finns inte i denna miljö
      else { const data = await res.json().catch(() => ({})); show(data.error || 'Något gick fel. Försök igen senare.', 'error') }
    } catch {
      await fallbackInsert() // nätverksfel / ingen funktion
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container fade-in">
      <div className="page-header">
        <h1>{page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>

      <div className="contact-grid" style={{ marginBottom: 'var(--space-9)' }}>
        <div>
          <div className="contact-info-card">
            <h3>{page.text('contacts_heading')}</h3>
            {loading ? (
              <p className="text-muted">Laddar…</p>
            ) : contacts.length === 0 ? (
              <p className="text-muted">Inga kontaktpersoner är tillgängliga för tillfället.</p>
            ) : (
              contacts.map(c => (
                <div key={c.id} className="contact-person">
                  <UserAvatar seed={c.id} size={44} gaze className="contact-person-avatar" />
                  <div>
                    <h4>{c.name}</h4>
                    {c.role && <p>{c.role}</p>}
                    {c.email && <p><a href={`mailto:${c.email}`}>{c.email}</a></p>}
                    {c.phone && <p>{c.phone}</p>}
                  </div>
                </div>
              ))
            )}
          </div>

          {settings?.social_links && Object.entries(settings.social_links).length > 0 && (
            <div className="contact-info-card" style={{ marginTop: 'var(--space-5)' }}>
              <h3>Sociala medier</h3>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {Object.entries(settings.social_links).map(([key, url]) => (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="section-link" style={{ textTransform: 'capitalize' }}>
                    {key} →
                  </a>
                ))}
              </div>
            </div>
          )}

          {settings?.privacy_text && (
            <div className="contact-info-card" style={{ marginTop: 'var(--space-5)' }}>
              <h3>Integritet</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>{settings.privacy_text}</p>
            </div>
          )}
        </div>

        <div>
          <form onSubmit={handleSubmit} className="card" noValidate>
            <h3 style={{ marginBottom: 'var(--space-5)' }}>{page.text('form_heading')}</h3>

            <div className="form-group">
              <label className="form-label" htmlFor="name">{page.text('label_name')} *</label>
              <input
                id="name"
                className="form-input"
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">{page.text('label_email')} *</label>
              <input
                id="email"
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="subject">{page.text('label_subject')}</label>
              <input
                id="subject"
                className="form-input"
                type="text"
                value={form.subject}
                onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="message">{page.text('label_message')} *</label>
              <textarea
                id="message"
                className="form-textarea"
                rows={5}
                value={form.message}
                onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                aria-invalid={!!errors.message}
              />
              {errors.message && <p className="form-error">{errors.message}</p>}
            </div>

            <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
              <label htmlFor="website">Lämna tomt</label>
              <input id="website" type="text" value={form.website} onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))} tabIndex={-1} autoComplete="off" />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Skickar…' : page.text('submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
