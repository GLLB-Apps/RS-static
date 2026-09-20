import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Contact } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import UserAvatar from '../../components/UserAvatar'

export default function AdminContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Contact | null>(null)
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    supabase.from('contacts').select('*').order('sort_order').then(({ data }) => {
      setContacts(data as Contact[] ?? [])
      setLoading(false)
    })
  }

  async function save() {
    if (!editing) return
    if (!editing.name.trim()) { show('Namn krävs', 'error'); return }
    const payload = {
      name: editing.name,
      role: editing.role || null,
      email: editing.email || null,
      phone: editing.phone || null,
      is_public: editing.is_public,
      sort_order: editing.sort_order,
    }
    if (editing.id) {
      const { error } = await supabase.from('contacts').update(payload).eq('id', editing.id)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show('Sparat', 'success')
    } else {
      const { error } = await supabase.from('contacts').insert(payload)
      if (error) show('Kunde inte skapa: ' + error.message, 'error')
      else show('Kontakt skapad', 'success')
    }
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!(await confirm({ message: 'Ta bort denna kontaktperson?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Borttagen', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Kontaktpersoner</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Link to="/admin/meddelanden" className="btn btn-ghost btn-sm">Meddelanden →</Link>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ id: '', name: '', role: '', email: '', phone: '', is_public: true, sort_order: contacts.length, created_at: '', updated_at: '' } as Contact)}>Ny kontakt</button>
        </div>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <UserAvatar seed={editing.email || editing.name} size={36} gaze style={{ flexShrink: 0 }} />
              <h3 style={{ margin: 0 }}>{editing.id ? 'Redigera kontakt' : 'Ny kontakt'}</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Stäng</button>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Namn *</label>
            <input id="name" className="form-input" type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="role">Roll</label>
            <input id="role" className="form-input" type="text" value={editing.role ?? ''} onChange={e => setEditing({ ...editing, role: e.target.value })} />
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-post</label>
              <input id="email" className="form-input" type="email" value={editing.email ?? ''} onChange={e => setEditing({ ...editing, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Telefon</label>
              <input id="phone" className="form-input" type="tel" value={editing.phone ?? ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            </div>
          </div>
          <div className="checkbox-group">
            <input id="is_public" type="checkbox" checked={editing.is_public} onChange={e => setEditing({ ...editing, is_public: e.target.checked })} />
            <label htmlFor="is_public" className="form-label" style={{ margin: 0 }}>Publik</label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={save}>Spara</button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="empty-state"><p>Inga kontaktpersoner finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {contacts.map(c => (
            <div key={c.id} className="admin-list-item">
              <UserAvatar seed={c.email || c.name} size={36} style={{ flexShrink: 0 }} />
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{c.name}</div>
                <div className="admin-list-item-meta">
                  {c.role && <span>{c.role}</span>}
                  {c.email && <span>{c.email}</span>}
                  {!c.is_public && <span className="badge badge-muted">Dold</span>}
                </div>
              </div>
              <div className="admin-table-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(c)}>Redigera</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
