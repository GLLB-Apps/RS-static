import { useEffect, useState } from 'react'
import type { FaqCategory, FaqItem, ContentStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { statusLabel, statusBadgeClass } from '../../lib/utils'
import UserAvatar from '../../components/UserAvatar'

export default function AdminFaq() {
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FaqItem | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => {
    Promise.all([
      supabase.from('faq_categories').select('*').order('sort_order'),
      supabase.from('faq_items').select('*').order('sort_order'),
    ]).then(([c, i]) => {
      setCategories(c.data as FaqCategory[] ?? [])
      setItems(i.data as FaqItem[] ?? [])
      setLoading(false)
    })
  }, [])

  async function addCategory() {
    if (!newCategory.trim()) return
    const slug = newCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const { error } = await supabase.from('faq_categories').insert({ name: newCategory, slug, sort_order: categories.length })
    if (error) show('Kunde inte skapa kategori: ' + error.message, 'error')
    else {
      show('Kategori skapad', 'success')
      setNewCategory('')
      const { data } = await supabase.from('faq_categories').select('*').order('sort_order')
      setCategories(data as FaqCategory[] ?? [])
    }
  }

  async function saveItem() {
    if (!editing) return
    if (!editing.question.trim() || !editing.answer.trim()) { show('Fråga och svar krävs', 'error'); return }
    const payload = {
      question: editing.question,
      answer: editing.answer,
      category_id: editing.category_id,
      sort_order: editing.sort_order,
      status: editing.status,
    }
    if (editing.id) {
      const { error } = await supabase.from('faq_items').update(payload).eq('id', editing.id)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show('Sparat', 'success')
    } else {
      const { error } = await supabase.from('faq_items').insert({ ...payload, published_at: editing.status === 'published' ? new Date().toISOString() : null })
      if (error) show('Kunde inte skapa: ' + error.message, 'error')
      else show('Fråga skapad', 'success')
    }
    setEditing(null)
    const { data } = await supabase.from('faq_items').select('*').order('sort_order')
    setItems(data as FaqItem[] ?? [])
  }

  async function removeItem(item: FaqItem) {
    if (!(await confirm({ message: `Ta bort frågan "${item.question}" permanent?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('faq_items').delete().eq('id', item.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    show('Frågan borttagen', 'success')
    if (editing?.id === item.id) setEditing(null)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  // Obesvarade — främst insända via frågeformuläret på FAQ-sidan, men även
  // ett utkast som skapats i admin utan svar ännu — hamnar i en egen grupp
  // överst, så de inte försvinner bland de redan besvarade.
  const unanswered = items.filter(i => !i.answer.trim())
  const answered = items.filter(i => i.answer.trim())

  function renderRow(item: FaqItem) {
    return (
      <div key={item.id} className="admin-list-item">
        <UserAvatar seed={item.question} size={36} style={{ flexShrink: 0 }} />
        <div className="admin-list-item-info">
          <div className="admin-list-item-title">{item.question}</div>
          <div className="admin-list-item-meta">
            <span className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</span>
            <span>{categories.find(c => c.id === item.category_id)?.name ?? 'Ingen kategori'}</span>
          </div>
        </div>
        <div className="admin-table-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(item)}>{item.answer.trim() ? 'Redigera' : 'Svara'}</button>
          <button className="btn btn-danger btn-sm" onClick={() => removeItem(item)}>Ta bort</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>FAQ</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ id: '', question: '', answer: '', category_id: categories[0]?.id ?? null, sort_order: 0, status: 'draft' as ContentStatus, published_at: null, created_at: '', updated_at: '' })}>Ny fråga</button>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Kategorier</h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <input className="form-input" type="text" placeholder="Ny kategori" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={addCategory}>Lägg till</button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
          {categories.map(c => <span key={c.id} className="badge">{c.name}</span>)}
        </div>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3>{editing.id ? 'Redigera fråga' : 'Ny fråga'}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Stäng</button>
          </div>
          <div className="admin-login-avatar-preview">
            <UserAvatar seed={editing.question} size={72} gaze title="Frågans figur" />
            <p className="form-hint" style={{ margin: 0 }}>Figuren skapas av frågetexten och ändras medan du skriver — samma logik som vittnesmålet.</p>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="question">Fråga</label>
            <input id="question" className="form-input" type="text" value={editing.question} onChange={e => setEditing({ ...editing, question: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="answer">Svar</label>
            <textarea id="answer" className="form-textarea" rows={3} value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })} />
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="cat">Kategori</label>
              <select id="cat" className="form-select" value={editing.category_id ?? ''} onChange={e => setEditing({ ...editing, category_id: e.target.value || null })}>
                <option value="">—</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" className="form-select" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as ContentStatus })}>
                <option value="draft">Utkast</option>
                <option value="published">Publicerad</option>
                <option value="archived">Arkiverad</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveItem}>Spara</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state"><p>Inga frågor finns ännu.</p></div>
      ) : (
        <>
          {unanswered.length > 0 && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', color: 'var(--warning)' }}>
                Obesvarade frågor ({unanswered.length})
              </h2>
              <div className="admin-list">
                {unanswered.map(renderRow)}
              </div>
            </div>
          )}

          {answered.length > 0 && (
            <div>
              {unanswered.length > 0 && (
                <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>Besvarade frågor ({answered.length})</h2>
              )}
              <div className="admin-list">
                {answered.map(renderRow)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
