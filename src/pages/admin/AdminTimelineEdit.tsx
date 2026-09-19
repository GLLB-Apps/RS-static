import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import type { TimelineEvent, ContentStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'

export default function AdminTimelineEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const isNew = id === 'ny' || !id

  const [form, setForm] = useState({
    event_date: '', title: '', description: '', event_type: '',
    link_url: '', image_url: '', sort_order: 0,
  })
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase.from('timeline_events').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        const e = data as TimelineEvent
        setForm({
          event_date: e.event_date ?? '', title: e.title, description: e.description ?? '',
          event_type: e.event_type ?? '', link_url: e.link_url ?? '', image_url: e.image_url ?? '',
          sort_order: e.sort_order,
        })
        setStatus(e.status)
      }
      setLoading(false)
    })
  }, [id, isNew])

  function update(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(publish = false) {
    if (!form.title.trim()) { show('Titel krävs', 'error'); return }
    if (!form.event_date) { show('Datum krävs', 'error'); return }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    const payload = {
      event_date: form.event_date,
      title: form.title,
      description: form.description || null,
      event_type: form.event_type || null,
      link_url: form.link_url || null,
      image_url: form.image_url || null,
      sort_order: form.sort_order,
      status: saveStatus,
      updated_by: user?.id,
      published_at: publish ? new Date().toISOString() : null,
    }
    if (isNew) {
      const { error } = await supabase.from('timeline_events').insert({ ...payload, created_by: user?.id })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { show('Händelse skapad', 'success'); navigate('/admin/tidslinje') }
    } else {
      const { error } = await supabase.from('timeline_events').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show(publish ? 'Publicerad' : 'Sparat', 'success')
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>{isNew ? 'Ny tidslinjehändelse' : 'Redigera händelse'}{!isNew && form.title && <span className="admin-edit-subject"> — {form.title}</span>}</h1>
        <Link to="/admin/tidslinje" className="btn btn-ghost btn-sm">← Tillbaka</Link>
      </div>
      <div className="admin-form-card">
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="event_date">Datum *</label>
            <input id="event_date" className="form-input" type="date" value={form.event_date} onChange={e => update('event_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="event_type">Typ av händelse</label>
            <input id="event_type" className="form-input" type="text" value={form.event_type} onChange={e => update('event_type', e.target.value)} placeholder="T.ex. information, dokument, initiativ" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="title">Titel *</label>
          <input id="title" className="form-input" type="text" value={form.title} onChange={e => update('title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="description">Beskrivning</label>
          <textarea id="description" className="form-textarea" rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="link_url">Länk</label>
            <input id="link_url" className="form-input" type="url" value={form.link_url} onChange={e => update('link_url', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="image_url">Bild-URL</label>
            <input id="image_url" className="form-input" type="url" value={form.image_url} onChange={e => update('image_url', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="sort_order">Sorteringsordning</label>
          <input id="sort_order" className="form-input" type="number" value={form.sort_order} onChange={e => update('sort_order', Number(e.target.value))} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="status">Status</label>
          <select id="status" className="form-select" value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
            <option value="draft">Utkast</option>
            <option value="published">Publicerad</option>
            <option value="archived">Arkiverad</option>
          </select>
        </div>
        <div className="admin-form-actions">
          <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>Publicera</button>
        </div>
      </div>
    </div>
  )
}
