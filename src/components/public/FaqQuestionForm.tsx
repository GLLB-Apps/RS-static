import { useState } from 'react'
import type { FaqCategory } from '../../lib/types'
import UserAvatar from '../UserAvatar'

interface FaqQuestionFormProps {
  categories: FaqCategory[]
  onSubmit: (data: { question: string; category_id: string | null; website: string }) => Promise<void>
}

// Samma logik som vittnesmålsformuläret: fröet är själva texten man skriver,
// så figuren skapas av frågan och ändras live medan man skriver den.
export default function FaqQuestionForm({ categories, onSubmit }: FaqQuestionFormProps) {
  const [question, setQuestion] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (website) return
    if (!question.trim()) { setError('Skriv din fråga'); return }
    setError('')
    setSubmitting(true)
    await onSubmit({ question: question.trim(), category_id: categoryId || null, website })
    setSubmitting(false)
    setQuestion('')
    setCategoryId('')
  }

  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <div className="testimony-form-avatar-preview">
        <UserAvatar seed={question} size={88} gaze title="Din fråga får sin egen figur" />
        <p className="form-hint" style={{ margin: 0 }}>Figuren skapas av texten i din fråga och ändras medan du skriver.</p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="faq-question">Din fråga</label>
        <textarea
          id="faq-question"
          className="form-textarea"
          rows={4}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          aria-invalid={!!error}
        />
        {error && <p className="form-error">{error}</p>}
      </div>

      {categories.length > 0 && (
        <div className="form-group">
          <label className="form-label" htmlFor="faq-category">Kategori (valfritt)</label>
          <select id="faq-category" className="form-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Ingen särskild kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Honeypot */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor="faq-website">Lämna tomt</label>
        <input id="faq-website" type="text" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
      </div>

      <p className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>
        Frågan granskas innan den publiceras med ett svar.
      </p>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Skickar…' : 'Skicka fråga'}
      </button>
    </form>
  )
}
