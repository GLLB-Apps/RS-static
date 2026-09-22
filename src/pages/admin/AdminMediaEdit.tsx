import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { MediaItem, ContentStatus, MediaType } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import Dropzone from '../../components/admin/Dropzone'
import FocusModeToggle from '../../components/admin/FocusModeToggle'
import { useFocusMode } from '../../lib/focusMode'
import { FADE } from '../../lib/motionPresets'

export default function AdminMediaEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const { focusMode } = useFocusMode()
  const isNew = id === 'ny' || !id

  const [form, setForm] = useState({
    title: '', description: '', alt_text: '', photographer: '',
    media_date: '', location: '', media_type: 'image' as MediaType,
    file_url: '', video_url: '', rights_info: '', is_press_allowed: false,
  })
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase.from('media_items').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        const m = data as MediaItem
        setForm({
          title: m.title, description: m.description ?? '', alt_text: m.alt_text ?? '',
          photographer: m.photographer ?? '', media_date: m.media_date ?? '',
          location: m.location ?? '', media_type: m.media_type,
          file_url: m.file_url ?? '', video_url: m.video_url ?? '',
          rights_info: m.rights_info ?? '', is_press_allowed: m.is_press_allowed,
        })
        setStatus(m.status)
      }
      setLoading(false)
    })
  }, [id, isNew])

  function update(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(publish = false) {
    if (!form.title.trim()) { show('Titel krävs', 'error'); return }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    const payload = {
      title: form.title,
      description: form.description || null,
      alt_text: form.alt_text || null,
      photographer: form.photographer || null,
      media_date: form.media_date || null,
      location: form.location || null,
      media_type: form.media_type,
      file_url: form.file_url || null,
      video_url: form.video_url || null,
      rights_info: form.rights_info || null,
      is_press_allowed: form.is_press_allowed,
      status: saveStatus,
      updated_by: user?.id,
      published_at: publish ? new Date().toISOString() : null,
    }
    if (isNew) {
      const { error } = await supabase.from('media_items').insert({ ...payload, created_by: user?.id })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { show('Media skapad', 'success'); navigate('/admin/media') }
    } else {
      const { error } = await supabase.from('media_items').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show(publish ? 'Publicerad' : 'Sparat', 'success')
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <AnimatePresence initial={false}>
          {!focusMode && (
            <motion.h1 key="title" {...FADE}>
              {isNew ? 'Ny media' : 'Redigera media'}{!isNew && form.title && <span className="admin-edit-subject"> — {form.title}</span>}
            </motion.h1>
          )}
        </AnimatePresence>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <FocusModeToggle />
          <AnimatePresence initial={false}>
            {!focusMode && (
              <motion.div key="back" {...FADE}>
                <Link to="/admin/media" className="btn btn-ghost btn-sm">← Tillbaka</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="admin-form-card">
        <div className="form-group">
          <label className="form-label" htmlFor="title">Titel *</label>
          <input id="title" className="form-input" type="text" value={form.title} onChange={e => update('title', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="media_type">Typ</label>
            <select id="media_type" className="form-select" value={form.media_type} onChange={e => update('media_type', e.target.value)}>
              <option value="image">Bild</option>
              <option value="video">Video</option>
              <option value="map">Karta</option>
              <option value="graphic">Grafik</option>
              <option value="press_image">Pressbild</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="media_date">Datum</label>
            <input id="media_date" className="form-input" type="date" value={form.media_date} onChange={e => update('media_date', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="description">Beskrivning</label>
          <textarea id="description" className="form-textarea" rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="alt_text">Alt-text</label>
          <input id="alt_text" className="form-input" type="text" value={form.alt_text} onChange={e => update('alt_text', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="photographer">Fotograf / upphovsperson</label>
            <input id="photographer" className="form-input" type="text" value={form.photographer} onChange={e => update('photographer', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="location">Plats</label>
            <input id="location" className="form-input" type="text" value={form.location} onChange={e => update('location', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Bild / fil</label>
          {form.file_url && <img src={form.file_url} alt="" className="media-edit-preview" />}
          <Dropzone
            compact
            label={form.file_url ? 'Byt bild — dra hit eller klicka' : 'Dra och släpp en bild här'}
            onUploaded={url => update('file_url', url)}
            onComplete={() => show('Bild uppladdad', 'success')}
            onError={m => show('Uppladdning misslyckades: ' + m, 'error')}
          />
          <input className="form-input" type="url" value={form.file_url} onChange={e => update('file_url', e.target.value)} placeholder="…eller klistra in en URL" style={{ marginTop: 'var(--space-2)' }} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="video_url">Video-URL (YouTube/Vimeo embed)</label>
          <input id="video_url" className="form-input" type="url" value={form.video_url} onChange={e => update('video_url', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rights_info">Rättighetsinformation</label>
          <input id="rights_info" className="form-input" type="text" value={form.rights_info} onChange={e => update('rights_info', e.target.value)} placeholder="T.ex. CC BY 4.0, Alla rättigheter förbehållna" />
        </div>
        <div className="checkbox-group">
          <input id="is_press_allowed" type="checkbox" checked={form.is_press_allowed} onChange={e => update('is_press_allowed', e.target.checked)} />
          <label htmlFor="is_press_allowed" className="form-label" style={{ margin: 0 }}>Får användas av press</label>
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
