import { useEffect, useState } from 'react'
import type { Sponsor } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import Dropzone from '../../components/admin/Dropzone'

export default function AdminSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Sponsor | null>(null)
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('sponsors').select('*').then(({ data }) => {
      const list = (data as Sponsor[] ?? []).sort((a, b) => a.sort_order - b.sort_order)
      setSponsors(list)
      setLoading(false)
    })
  }

  async function reorder(next: Sponsor[]) {
    const updates = next
      .map((s, idx) => ({ id: s.id, from: s.sort_order, to: idx }))
      .filter(u => u.from !== u.to)
    setSponsors(next.map((s, idx) => ({ ...s, sort_order: idx })))
    await Promise.all(updates.map(u => supabase.from('sponsors').update({ sort_order: u.to }).eq('id', u.id)))
  }

  function move(sp: Sponsor, dir: -1 | 1) {
    const arr = [...sponsors]
    const i = arr.findIndex(s => s.id === sp.id)
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    reorder(arr)
  }

  async function toggleActive(sp: Sponsor) {
    const { error } = await supabase.from('sponsors').update({ is_active: !sp.is_active }).eq('id', sp.id)
    if (error) show('Kunde inte uppdatera', 'error')
    else setSponsors(prev => prev.map(s => s.id === sp.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function save() {
    if (!editing) return
    if (!editing.name.trim()) { show('Namn krävs', 'error'); return }
    const payload = {
      name: editing.name.trim(),
      image_url: editing.image_url || null,
      link_url: editing.link_url || null,
      is_active: editing.is_active,
      sort_order: editing.sort_order,
    }
    if (editing.id) {
      const { error } = await supabase.from('sponsors').update(payload).eq('id', editing.id)
      if (error) { show('Kunde inte spara: ' + error.message, 'error'); return }
      show('Sparat', 'success')
    } else {
      const { error } = await supabase.from('sponsors').insert({ ...payload, sort_order: sponsors.length })
      if (error) { show('Kunde inte skapa: ' + error.message, 'error'); return }
      show('Sponsor tillagd', 'success')
    }
    setEditing(null)
    load()
  }

  async function remove(sp: Sponsor) {
    if (!(await confirm({ message: `Ta bort sponsorn "${sp.name}"?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('sponsors').delete().eq('id', sp.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    show('Sponsor borttagen', 'success')
    setSponsors(prev => prev.filter(s => s.id !== sp.id))
  }

  function newSponsor() {
    setEditing({ id: '', name: '', image_url: null, link_url: null, is_active: true, sort_order: sponsors.length, created_at: '', updated_at: '' })
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Sponsorer</h1>
        <button className="btn btn-primary btn-sm" onClick={newSponsor}>Ny sponsor</button>
      </div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        Sponsorernas logotyper visas som en rullande rad (ticker) på startsidan – fyra i taget,
        resten rullar vidare. Ordningen här styr ordningen i tickern: <strong>ett steg ned</strong> i
        listan = <strong>ett steg åt höger</strong> i tickern.
      </p>

      {editing && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3>{editing.id ? 'Redigera sponsor' : 'Ny sponsor'}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Stäng</button>
          </div>
          <div className="form-group">
            <label className="form-label">Namn *</label>
            <input className="form-input" type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Logotyp</label>
            {editing.image_url ? (
              <div className="sponsor-edit-image">
                <img src={editing.image_url} alt="" />
                <button className="btn btn-ghost btn-xs" onClick={() => setEditing({ ...editing, image_url: null })}>Byt bild</button>
              </div>
            ) : (
              <Dropzone
                accept="image/*"
                label="Dra och släpp logotypen här"
                hint="PNG/SVG med transparent bakgrund ser bäst ut"
                onUploaded={url => setEditing(prev => prev ? { ...prev, image_url: url } : prev)}
                onError={msg => show('Uppladdning misslyckades: ' + msg, 'error')}
              />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Länk (valfritt)</label>
            <input className="form-input" type="url" value={editing.link_url ?? ''} onChange={e => setEditing({ ...editing, link_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="checkbox-group">
            <input id="sp_active" type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
            <label htmlFor="sp_active" className="form-label" style={{ margin: 0 }}>Visa i tickern</label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={save}>Spara</button>
        </div>
      )}

      {sponsors.length === 0 ? (
        <div className="empty-state"><p>Inga sponsorer finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {sponsors.map((sp, i) => (
            <div key={sp.id} className={sp.is_active ? 'admin-list-item' : 'admin-list-item is-inactive'}>
              <div className="sponsor-row-order">
                <button className="btn btn-ghost btn-xs" onClick={() => move(sp, -1)} disabled={i === 0} data-tooltip="Flytta vänster (upp)" aria-label="Flytta vänster">↑</button>
                <button className="btn btn-ghost btn-xs" onClick={() => move(sp, 1)} disabled={i === sponsors.length - 1} data-tooltip="Flytta höger (ned)" aria-label="Flytta höger">↓</button>
              </div>
              <div className="sponsor-row-logo">
                {sp.image_url ? <img src={sp.image_url} alt={sp.name} /> : <span className="sponsor-row-noimg">Ingen bild</span>}
              </div>
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{sp.name}</div>
                <div className="admin-list-item-meta">
                  <span>Plats {i + 1}</span>
                  {!sp.is_active && <span className="badge badge-muted">Dold</span>}
                  {sp.link_url && <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{sp.link_url}</span>}
                </div>
              </div>
              <div className="admin-table-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(sp)}>{sp.is_active ? 'Dölj' : 'Visa'}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(sp)}>Redigera</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(sp)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
