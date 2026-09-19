import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotifications } from '../../lib/notifications'

interface Stats {
  publishedTopics: number
  draftTopics: number
  publishedPosts: number
  draftPosts: number
  pendingTestimonies: number
  unreadMessages: number
  documents: number
  mediaItems: number
  publishedTimeline: number
  mapPoints: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentEdits, setRecentEdits] = useState<{ table: string; title: string; updated_at: string }[]>([])
  // Utkastsumman kommer från notiskällan, så kortet och klockan alltid är samstämmiga.
  const { newBySource, draftTotal } = useNotifications()

  useEffect(() => {
    Promise.all([
      supabase.from('topics').select('id,status,updated_at,title').order('updated_at', { ascending: false }).limit(5),
      supabase.from('posts').select('id,status,updated_at,title').order('updated_at', { ascending: false }).limit(5),
    ]).then(([t, p]) => {
      const edits: { table: string; title: string; updated_at: string }[] = []
      ;(t.data ?? []).forEach((row: Record<string, unknown>) => edits.push({ table: 'Ämne', title: row.title as string, updated_at: row.updated_at as string }))
      ;(p.data ?? []).forEach((row: Record<string, unknown>) => edits.push({ table: 'Nyhet', title: row.title as string, updated_at: row.updated_at as string }))
      edits.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setRecentEdits(edits.slice(0, 8))
    })

    Promise.all([
      supabase.from('topics').select('status'),
      supabase.from('posts').select('status'),
      supabase.from('testimonies').select('status').eq('status', 'pending'),
      supabase.from('contact_messages').select('status').eq('status', 'unread'),
      supabase.from('documents').select('id'),
      supabase.from('media_items').select('id'),
      supabase.from('timeline_events').select('status').eq('status', 'published'),
      supabase.from('map_locations').select('id'),
    ]).then(([t, p, te, cm, d, m, tl, mp]) => {
      const topics = t.data ?? []
      const posts = p.data ?? []
      setStats({
        publishedTopics: topics.filter((r: Record<string, string>) => r.status === 'published').length,
        draftTopics: topics.filter((r: Record<string, string>) => r.status === 'draft').length,
        publishedPosts: posts.filter((r: Record<string, string>) => r.status === 'published').length,
        draftPosts: posts.filter((r: Record<string, string>) => r.status === 'draft').length,
        pendingTestimonies: te.data?.length ?? 0,
        unreadMessages: cm.data?.length ?? 0,
        documents: d.data?.length ?? 0,
        mediaItems: m.data?.length ?? 0,
        publishedTimeline: tl.data?.length ?? 0,
        mapPoints: mp.data?.length ?? 0,
      })
    })
  }, [])

  if (!stats) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Översikt</h1>
      </div>

      <div className="admin-quick-actions">
        <Link to="/admin/nyheter/ny" className="btn btn-primary btn-sm">Ny nyhet</Link>
        <Link to="/admin/amnen/ny" className="btn btn-secondary btn-sm">Nytt ämne</Link>
        <Link to="/admin/dokument/ny" className="btn btn-secondary btn-sm">Ladda upp dokument</Link>
        <Link to="/admin/media/ny" className="btn btn-secondary btn-sm">Lägg till bild</Link>
        <Link to="/admin/karta/ny" className="btn btn-secondary btn-sm">Skapa kartpunkt</Link>
        <Link to="/admin/tidslinje/ny" className="btn btn-secondary btn-sm">Tidslinjehändelse</Link>
      </div>

      <div className="admin-stats">
        <Link to="/admin/utkast" className="admin-stat-card admin-stat-card-link">
          {newBySource.drafts > 0 && <span className="admin-stat-badge">{newBySource.drafts} nya</span>}
          <div className="admin-stat-label">Utkast totalt</div>
          <div className="admin-stat-value">{draftTotal}</div>
        </Link>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Publicerade ämnen</div>
          <div className="admin-stat-value">{stats.publishedTopics}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Utkast ämnen</div>
          <div className="admin-stat-value">{stats.draftTopics}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Publicerade nyheter</div>
          <div className="admin-stat-value">{stats.publishedPosts}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Utkast nyheter</div>
          <div className="admin-stat-value">{stats.draftPosts}</div>
        </div>
        <Link to="/admin/vittnesmal" className="admin-stat-card admin-stat-card-link">
          {newBySource.testimonies > 0 && <span className="admin-stat-badge">{newBySource.testimonies} nya</span>}
          <div className="admin-stat-label">Vittnesmål väntar</div>
          <div className="admin-stat-value" style={{ color: stats.pendingTestimonies > 0 ? 'var(--warning)' : undefined }}>{stats.pendingTestimonies}</div>
        </Link>
        <Link to="/admin/meddelanden" className="admin-stat-card admin-stat-card-link">
          {newBySource.messages > 0 && <span className="admin-stat-badge">{newBySource.messages} nya</span>}
          <div className="admin-stat-label">Olästa meddelanden</div>
          <div className="admin-stat-value" style={{ color: stats.unreadMessages > 0 ? 'var(--warning)' : undefined }}>{stats.unreadMessages}</div>
        </Link>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Dokument</div>
          <div className="admin-stat-value">{stats.documents}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Media</div>
          <div className="admin-stat-value">{stats.mediaItems}</div>
        </div>
      </div>

      <h2 className="admin-section-title">Senaste redigeringar</h2>
      {recentEdits.length === 0 ? (
        <p className="text-muted">Inga redigeringar ännu.</p>
      ) : (
        <div className="admin-list">
          {recentEdits.map((edit, i) => (
            <div key={i} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{edit.title}</div>
                <div className="admin-list-item-meta">
                  <span>{edit.table}</span>
                  <span>{new Date(edit.updated_at).toLocaleDateString('sv-SE')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
