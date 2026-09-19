import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort, statusLabel, statusBadgeClass } from '../../lib/utils'
import { DEFAULT_NEWS_CATEGORY, NEWS_CATEGORIES, newsCategoryBadge, newsCategoryLabel, postTags } from '../../lib/newsCategories'

export default function AdminNews() {
  const [posts, setPosts] = useState<Post[]>([])
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const { confirm } = useConfirm()

  function load() {
    setLoading(true)
    supabase.from('posts').select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data as Post[] ?? [])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  async function remove(id: string, title: string) {
    if (!(await confirm({ message: `Ta bort nyheten "${title}" permanent?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Nyheten borttagen', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const shown = category ? posts.filter(p => (p.category ?? DEFAULT_NEWS_CATEGORY) === category) : posts

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Nyheter</h1>
        <Link to="/admin/nyheter/ny" className="btn btn-primary btn-sm">Ny nyhet</Link>
      </div>
      {posts.length > 0 && (
        <div className="filter-chips" style={{ marginBottom: 'var(--space-5)' }}>
          <button type="button" className={`filter-chip${category === '' ? ' is-active' : ''}`} onClick={() => setCategory('')}>
            Alla <span className="filter-chip-count">{posts.length}</span>
          </button>
          {NEWS_CATEGORIES.map(c => {
            const count = posts.filter(p => (p.category ?? DEFAULT_NEWS_CATEGORY) === c.key).length
            if (count === 0) return null
            return (
              <button
                key={c.key}
                type="button"
                className={`filter-chip${category === c.key ? ' is-active' : ''}`}
                onClick={() => setCategory(category === c.key ? '' : c.key)}
              >
                {c.label} <span className="filter-chip-count">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty-state"><p>{posts.length === 0 ? 'Inga nyheter finns ännu.' : 'Inget i den här kategorin.'}</p></div>
      ) : (
        <div className="admin-list">
          {shown.map(p => (
            <div key={p.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">
                  {p.title} {p.is_pinned && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Fäst</span>}
                </div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span>
                  <span className={newsCategoryBadge(p.category ?? DEFAULT_NEWS_CATEGORY)}>{newsCategoryLabel(p.category)}</span>
                  <span>/{p.slug}</span>
                  <span>{p.published_at ? formatDateShort(p.published_at) : 'Inget datum'}</span>
                  {postTags(p).length > 0 && <span>#{postTags(p).join(' #')}</span>}
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={`/admin/nyheter/${p.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id, p.title)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
