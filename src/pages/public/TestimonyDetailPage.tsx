import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate, testimonyBlobSeed } from '../../lib/utils'
import { useRegisterEditLink } from '../../lib/editLink'
import UserAvatar from '../../components/UserAvatar'
import TestimonyMap from '../../components/public/TestimonyMap'

export default function TestimonyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [testimony, setTestimony] = useState<Testimony | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('testimonies')
      .select('*')
      .eq('id', id)
      .eq('status', 'approved')
      .maybeSingle()
      .then(({ data }) => {
        setTestimony(data as Testimony | null)
        setLoading(false)
      })
  }, [id])

  // AdminTestimonies har ingen egen route per post (en lista med ett
  // urvalsläge i minnet) — modereringskön är den bästa tillgängliga länken.
  useRegisterEditLink('/admin/vittnesmal')

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!testimony) {
    return (
      <div className="empty-state">
        <h1>Vittnesmålet hittades inte</h1>
        <Link to="/vittnesmal" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>Tillbaka till vittnesmål</Link>
      </div>
    )
  }

  const author = testimony.is_anonymous ? 'Anonym' : (testimony.author_name || 'Anonym')

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <Link to="/vittnesmal" className="section-link" style={{ marginBottom: 'var(--space-3)' }}>← Alla vittnesmål</Link>
        <div className="testimony-detail-head">
          <UserAvatar seed={testimonyBlobSeed(testimony.author_name ?? '', testimony.story, testimony.is_anonymous)} size={64} gaze title={author} />
          <div>
            <h1>{testimony.title || 'Vittnesmål'}</h1>
            <p className="testimony-detail-meta">
              {author}
              {testimony.location && `, ${testimony.location}`}
              {testimony.published_at && ` · ${formatDate(testimony.published_at)}`}
            </p>
          </div>
        </div>
      </div>

      {testimony.featured_image && (
        <img src={testimony.featured_image} alt="" className="testimony-detail-image" />
      )}

      <p className="testimony-detail-story">{testimony.story}</p>

      {testimony.area_usage && (
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>
          Användning av området: {testimony.area_usage}
        </p>
      )}

      {testimony.map_lat != null && testimony.map_lng != null && (
        <div className="testimony-detail-map-wrap">
          <h2 style={{ fontSize: '1.1rem' }}>Utpekad plats</h2>
          <TestimonyMap testimonies={[testimony]} selectedId={testimony.id} onSelect={() => {}} height={360} />
        </div>
      )}
    </div>
  )
}
