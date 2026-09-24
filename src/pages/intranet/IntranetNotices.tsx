import { useEffect, useState } from 'react'
import { Pin, PinOff, Trash2, Plus } from 'lucide-react'
import type { IntranetNotice } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { timeAgo } from '../../lib/notifications'
import { useMarkIntranetRead } from '../../lib/intranetNotifications'

// Anslagstavlan — startsidan i intranätet. Korta meddelanden till gruppen,
// fastnålade först, därefter senaste först.
export default function IntranetNotices() {
  const { user, isAdmin, canWriteIntranet } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [notices, setNotices] = useState<IntranetNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  useMarkIntranetRead('notices', !loading)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('intranet_notices').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setNotices((data as IntranetNotice[]) ?? [])
      setLoading(false)
    })
  }

  const sorted = [...notices].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  async function post() {
    if (!title.trim()) { show('Rubrik krävs', 'error'); return }
    const { error } = await supabase.from('intranet_notices').insert({
      title: title.trim(),
      body: body.trim() || null,
      author: user?.email ?? null,
      author_id: user?.id ?? null,
      pinned: false,
    })
    if (error) { show('Kunde inte publicera: ' + error.message, 'error'); return }
    show('Anslag publicerat', 'success')
    setTitle(''); setBody(''); setComposing(false); load()
  }

  async function togglePin(n: IntranetNotice) {
    const { error } = await supabase.from('intranet_notices').update({ pinned: !n.pinned }).eq('id', n.id)
    if (error) { show('Kunde inte ändra: ' + error.message, 'error'); return }
    setNotices(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
  }

  async function remove(n: IntranetNotice) {
    if (!(await confirm({ message: `Ta bort anslaget "${n.title}"?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('intranet_notices').delete().eq('id', n.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    setNotices(prev => prev.filter(x => x.id !== n.id))
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Anslagstavla</h1>
        {canWriteIntranet && !composing && <button className="btn btn-primary btn-sm" onClick={() => setComposing(true)}><Plus size={16} /> Nytt anslag</button>}
      </div>

      {composing && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="form-group">
            <label className="form-label">Rubrik *</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Meddelande</label>
            <textarea className="form-textarea" rows={4} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="admin-form-actions">
            <button className="btn btn-primary" onClick={post}>Publicera</button>
            <button className="btn btn-ghost" onClick={() => { setComposing(false); setTitle(''); setBody('') }}>Avbryt</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state"><p>Inga anslag ännu. Skriv det första.</p></div>
      ) : (
        <div className="intranet-notices">
          {sorted.map(n => (
            <article key={n.id} className={n.pinned ? 'intranet-notice is-pinned' : 'intranet-notice'}>
              <div className="intranet-notice-head">
                <h2 className="intranet-notice-title">{n.pinned && <Pin size={14} aria-hidden="true" />} {n.title}</h2>
                <div className="intranet-notice-actions">
                  {canWriteIntranet && (
                    <button className="intdoc-icon-btn" data-tooltip={n.pinned ? 'Lossa' : 'Nåla fast'} aria-label={n.pinned ? 'Lossa' : 'Nåla fast'} onClick={() => togglePin(n)}>
                      {n.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                    </button>
                  )}
                  {(n.author_id === user?.id || isAdmin) && (
                    <button className="intdoc-icon-btn danger" data-tooltip="Ta bort" aria-label="Ta bort" onClick={() => remove(n)}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
              {n.body && <p className="intranet-notice-body">{n.body}</p>}
              <div className="intranet-notice-meta">{n.author || 'Okänd'} · {timeAgo(n.created_at)}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
