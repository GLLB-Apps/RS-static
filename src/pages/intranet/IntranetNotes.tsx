import { useEffect, useMemo, useState } from 'react'
import { Plus, Pin, Trash2, Pencil, X } from 'lucide-react'
import type { IntranetNote } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort } from '../../lib/utils'
import { useMarkIntranetRead } from '../../lib/intranetNotifications'

// Anteckningar: mötesanteckningar, idéer och strategimaterial som fritext.
// Kategorin grupperar och filtrerar; fastnålade visas först.
const emptyDraft = { title: '', body: '', category: '' }

export default function IntranetNotes() {
  const { user, isAdmin, canWriteIntranet } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [notes, setNotes] = useState<IntranetNote[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<IntranetNote | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [creating, setCreating] = useState(false)
  useMarkIntranetRead('notes', !loading)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('intranet_notes').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      setNotes((data as IntranetNote[]) ?? [])
      setLoading(false)
    })
  }

  const categories = useMemo(
    () => Array.from(new Set(notes.map(n => n.category).filter(Boolean))) as string[],
    [notes],
  )

  const visible = useMemo(() => {
    const list = filter ? notes.filter(n => n.category === filter) : notes
    return [...list].sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [notes, filter])

  async function create() {
    if (!draft.title.trim()) { show('Titel krävs', 'error'); return }
    const { error } = await supabase.from('intranet_notes').insert({
      title: draft.title.trim(),
      body: draft.body.trim() || null,
      category: draft.category.trim() || null,
      pinned: false,
      created_by: user?.id ?? null,
      created_by_name: user?.email ?? null,
    })
    if (error) { show('Kunde inte spara: ' + error.message, 'error'); return }
    show('Anteckning skapad', 'success')
    setDraft(emptyDraft); setCreating(false); load()
  }

  async function saveEdit() {
    if (!editing) return
    if (!editing.title.trim()) { show('Titel krävs', 'error'); return }
    const { error } = await supabase.from('intranet_notes').update({
      title: editing.title.trim(),
      body: editing.body?.trim() || null,
      category: editing.category?.trim() || null,
    }).eq('id', editing.id)
    if (error) { show('Kunde inte spara: ' + error.message, 'error'); return }
    show('Sparat', 'success'); setEditing(null); load()
  }

  async function togglePin(n: IntranetNote) {
    const { error } = await supabase.from('intranet_notes').update({ pinned: !n.pinned }).eq('id', n.id)
    if (error) { show('Kunde inte ändra: ' + error.message, 'error'); return }
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
  }

  async function remove(n: IntranetNote) {
    if (!(await confirm({ message: `Ta bort anteckningen "${n.title}"?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('intranet_notes').delete().eq('id', n.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    setNotes(prev => prev.filter(x => x.id !== n.id))
  }

  const canEdit = (n: IntranetNote) => n.created_by === user?.id || isAdmin

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Anteckningar</h1>
        {canWriteIntranet && !creating && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={16} /> Ny anteckning</button>}
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Titel *</label>
              <input className="form-input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <input className="form-input" list="note-cats" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="t.ex. Möten, Strategi" />
              <datalist id="note-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Innehåll</label>
            <textarea className="form-textarea" rows={6} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
          </div>
          <div className="admin-form-actions">
            <button className="btn btn-primary" onClick={create}>Spara</button>
            <button className="btn btn-ghost" onClick={() => { setCreating(false); setDraft(emptyDraft) }}>Avbryt</button>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="intdoc-filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
          <button className={filter === '' ? 'intdoc-pill active' : 'intdoc-pill'} onClick={() => setFilter('')}>Alla</button>
          {categories.map(c => (
            <button key={c} className={filter === c ? 'intdoc-pill active' : 'intdoc-pill'} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state"><p>Inga anteckningar ännu.</p></div>
      ) : (
        <div className="intranet-notes-grid">
          {visible.map(n => (
            <article key={n.id} className={n.pinned ? 'intranet-note is-pinned' : 'intranet-note'}>
              <div className="intranet-note-head">
                <h2 className="intranet-note-title">{n.title}</h2>
                <div className="intranet-note-actions">
                  {canWriteIntranet && <button className="intdoc-icon-btn" data-tooltip={n.pinned ? 'Lossa' : 'Nåla fast'} aria-label={n.pinned ? 'Lossa' : 'Nåla fast'} onClick={() => togglePin(n)}><Pin size={15} /></button>}
                  {canEdit(n) && <button className="intdoc-icon-btn" data-tooltip="Redigera" aria-label="Redigera" onClick={() => setEditing(n)}><Pencil size={15} /></button>}
                  {canEdit(n) && <button className="intdoc-icon-btn danger" data-tooltip="Ta bort" aria-label="Ta bort" onClick={() => remove(n)}><Trash2 size={15} /></button>}
                </div>
              </div>
              {n.category && <span className="intdoc-item-cat">{n.category}</span>}
              {n.body && <p className="intranet-note-body">{n.body}</p>}
              <div className="intranet-note-meta">{n.created_by_name || 'Okänd'} · {formatDateShort(n.updated_at)}</div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="intdoc-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="intdoc-modal" onClick={e => e.stopPropagation()}>
            <div className="intdoc-modal-head">
              <h3>Redigera anteckning</h3>
              <button className="intdoc-icon-btn" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Titel *</label>
                <input className="form-input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <input className="form-input" list="note-cats" value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Innehåll</label>
              <textarea className="form-textarea" rows={8} value={editing.body ?? ''} onChange={e => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <div className="admin-form-actions">
              <button className="btn btn-primary" onClick={saveEdit}>Spara</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
