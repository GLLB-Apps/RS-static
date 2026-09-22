import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { DocumentItem, ContentStatus, SenderType } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import Dropzone from '../../components/admin/Dropzone'
import FocusModeToggle from '../../components/admin/FocusModeToggle'
import { useFocusMode } from '../../lib/focusMode'
import { FADE } from '../../lib/motionPresets'

// Derive a human file-type label (e.g. "PDF") from a filename or URL.
function fileTypeFromName(name: string): string {
  const clean = name.split(/[?#]/)[0]
  const ext = clean.includes('.') ? clean.split('.').pop() ?? '' : ''
  return ext ? ext.toUpperCase() : ''
}

export default function AdminDocumentEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const { focusMode } = useFocusMode()
  const isNew = id === 'ny' || !id

  const [form, setForm] = useState({
    title: '', description: '', file_url: '', external_url: '',
    document_date: '', sender: '', sender_type: '', file_type: '', source: '',
  })
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase.from('documents').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        const d = data as DocumentItem
        setForm({
          title: d.title, description: d.description ?? '', file_url: d.file_url ?? '', external_url: d.external_url ?? '',
          document_date: d.document_date ?? '', sender: d.sender ?? '', sender_type: d.sender_type ?? '',
          file_type: d.file_type ?? '', source: d.source ?? '',
        })
        setStatus(d.status)
      }
      setLoading(false)
    })
  }, [id, isNew])

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(publish = false) {
    if (!form.title.trim()) { show('Titel krävs', 'error'); return }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    const payload = {
      title: form.title,
      description: form.description || null,
      file_url: form.file_url || null,
      external_url: form.external_url || null,
      document_date: form.document_date || null,
      sender: form.sender || null,
      sender_type: (form.sender_type || null) as SenderType | null,
      file_type: form.file_type || null,
      source: form.source || null,
      status: saveStatus,
      updated_by: user?.id,
      published_at: publish ? new Date().toISOString() : null,
    }
    if (isNew) {
      const { error } = await supabase.from('documents').insert({ ...payload, created_by: user?.id })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { show('Dokument skapat', 'success'); navigate('/admin/dokument') }
    } else {
      const { error } = await supabase.from('documents').update(payload).eq('id', id)
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
              {isNew ? 'Nytt dokument' : 'Redigera dokument'}{!isNew && form.title && <span className="admin-edit-subject"> — {form.title}</span>}
            </motion.h1>
          )}
        </AnimatePresence>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <FocusModeToggle />
          <AnimatePresence initial={false}>
            {!focusMode && (
              <motion.div key="back" {...FADE}>
                <Link to="/admin/dokument" className="btn btn-ghost btn-sm">← Tillbaka</Link>
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
        <div className="form-group">
          <label className="form-label" htmlFor="description">Beskrivning</label>
          <textarea id="description" className="form-textarea" rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Dokumentfil</label>
          {form.file_url ? (
            <div className="doc-file-chip">
              <span className="doc-file-type">{form.file_type || 'FIL'}</span>
              <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="doc-file-link">Öppna uppladdad fil</a>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm(prev => ({ ...prev, file_url: '', file_type: '' }))}>Ta bort</button>
            </div>
          ) : (
            <Dropzone
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.zip,application/pdf"
              label="Dra och släpp dokumentet här"
              hint="PDF, Word, Excel m.fl. – eller klicka för att välja"
              onUploaded={(url, file) => setForm(prev => ({ ...prev, file_url: url, file_type: fileTypeFromName(file.name) }))}
              onError={msg => show('Uppladdning misslyckades: ' + msg, 'error')}
            />
          )}
          <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 'var(--space-2)' }}>
            Filformatet känns igen automatiskt. Har dokumentet redan en adress på webben kan du i stället ange en extern länk nedan.
          </p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="external_url">Extern länk (om filen ligger på annan webbplats)</label>
          <input id="external_url" className="form-input" type="url" value={form.external_url} onChange={e => update('external_url', e.target.value)} placeholder="https://…" />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="document_date">Dokumentdatum</label>
            <input id="document_date" className="form-input" type="date" value={form.document_date} onChange={e => update('document_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sender">Avsändare</label>
            <input id="sender" className="form-input" type="text" value={form.sender} onChange={e => update('sender', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="sender_type">Avsändartyp</label>
            <select id="sender_type" className="form-select" value={form.sender_type} onChange={e => update('sender_type', e.target.value)}>
              <option value="">—</option>
              <option value="ncc">NCC</option>
              <option value="lund_kommun">Lunds kommun</option>
              <option value="authority">Myndighet</option>
              <option value="media">Media</option>
              <option value="initiative">Initiativet</option>
              <option value="private">Privatperson</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="source">Källa</label>
            <input id="source" className="form-input" type="text" value={form.source} onChange={e => update('source', e.target.value)} />
          </div>
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
