import { useEffect, useState } from 'react'
import type { ContactMessage } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort, statusLabel, statusBadgeClass } from '../../lib/utils'
import { useMarkSourceRead } from '../../lib/notifications'
import UserAvatar from '../../components/UserAvatar'

export default function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [note, setNote] = useState('')
  const { show } = useToast()
  const { confirm } = useConfirm()
  useMarkSourceRead('messages', !loading)

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setMessages(data as ContactMessage[] ?? [])
      setLoading(false)
    })
  }

  async function openMessage(msg: ContactMessage) {
    setSelected(msg)
    setNote(msg.internal_note ?? '')
    if (msg.status === 'unread') {
      await supabase.from('contact_messages').update({ status: 'read' }).eq('id', msg.id)
      load()
    }
  }

  async function updateStatus(status: 'handled' | 'archived') {
    if (!selected) return
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', selected.id)
    if (error) show('Kunde inte uppdatera', 'error')
    else { show('Status uppdaterad', 'success'); setSelected(null); load() }
  }

  async function saveNote() {
    if (!selected) return
    const { error } = await supabase.from('contact_messages').update({ internal_note: note }).eq('id', selected.id)
    if (error) show('Kunde inte spara', 'error')
    else { show('Anteckning sparad', 'success'); load() }
  }

  async function remove(id: string) {
    if (!(await confirm({ message: 'Ta bort detta meddelande permanent?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('contact_messages').delete().eq('id', id)
    if (error) show('Kunde inte ta bort', 'error')
    else { show('Borttaget', 'success'); setSelected(null); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Formulärmeddelanden</h1>
      </div>

      {selected && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <UserAvatar seed={selected.email} size={36} gaze style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: 0 }}>{selected.subject || 'Utan ämne'}</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Från: {selected.name} ({selected.email}) — {formatDateShort(selected.created_at)}</p>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Stäng</button>
          </div>
          <p style={{ marginBottom: 'var(--space-4)', whiteSpace: 'pre-wrap' }}>{selected.message}</p>
          <div className="form-group">
            <label className="form-label" htmlFor="note">Intern anteckning</label>
            <textarea id="note" className="form-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div className="admin-form-actions">
            <button className="btn btn-primary btn-sm" onClick={saveNote}>Spara anteckning</button>
            <button className="btn btn-secondary btn-sm" onClick={() => updateStatus('handled')}>Markera som hanterat</button>
            <button className="btn btn-secondary btn-sm" onClick={() => updateStatus('archived')}>Arkivera</button>
            <button className="btn btn-danger btn-sm" onClick={() => remove(selected.id)}>Ta bort</button>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="empty-state"><p>Inga meddelanden finns.</p></div>
      ) : (
        <div className="admin-list">
          {messages.map(m => (
            <div key={m.id} className="admin-list-item">
              <UserAvatar seed={m.email} size={36} style={{ flexShrink: 0 }} />
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{m.subject || 'Utan ämne'} {m.status === 'unread' && <span className="badge badge-warning">Ny</span>}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(m.status)}>{statusLabel(m.status)}</span>
                  <span>{m.name}</span>
                  <span>{formatDateShort(m.created_at)}</span>
                </div>
              </div>
              <div className="admin-table-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openMessage(m)}>Läs</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
