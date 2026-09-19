import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CustomPage } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { statusLabel, statusBadgeClass } from '../../lib/utils'

export default function AdminCustomPages() {
  const [pages, setPages] = useState<CustomPage[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => { load() }, [])
  function load() {
    setLoading(true)
    supabase.from('custom_pages').select('*').order('sort_order').then(({ data }) => {
      setPages(data as CustomPage[] ?? [])
      setLoading(false)
    })
  }

  async function remove(p: CustomPage) {
    if (!(await confirm({ message: `Ta bort sidan "${p.title}"? Adressen /${p.slug} slutar fungera.`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('custom_pages').delete().eq('id', p.id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Sidan borttagen', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Fristående sidor</h1>
        <Link to="/admin/egna-sidor/ny" className="btn btn-primary btn-sm">Ny sida</Link>
      </div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        Skapa fristående sidor med block-editorn. Varje sida får en egen adress (t.ex. <code>/om-oss</code>)
        och kan läggas in i menyn under <Link to="/admin/meny">Meny</Link>.
      </p>

      {pages.length === 0 ? (
        <div className="empty-state"><p>Inga egna sidor än.</p></div>
      ) : (
        <div className="admin-list fade-in">
          {pages.map(p => (
            <div key={p.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{p.title || '(namnlös)'}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>/{p.slug}</span>
                </div>
              </div>
              <div className="admin-table-actions">
                {p.status === 'published' && <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Visa</a>}
                <Link to={`/admin/egna-sidor/${p.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
