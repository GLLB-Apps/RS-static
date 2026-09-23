import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Topic } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'
import { ContentBlocks } from '../../components/public/blocks'
import { useRegisterEditLink } from '../../lib/editLink'

export default function TopicDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('topics')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        setTopic(data as Topic | null)
        setLoading(false)
      })
  }, [slug])

  useRegisterEditLink(topic ? `/admin/amnen/${topic.id}` : null)

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!topic) {
    return (
      <div className="empty-state">
        <h1>Ämnet hittades inte</h1>
        <p>Det här ämnet är inte tillgängligt eller har inte publicerats.</p>
        <Link to="/amnen" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>Tillbaka till ämnen</Link>
      </div>
    )
  }

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <Link to="/amnen" className="section-link" style={{ marginBottom: 'var(--space-3)' }}>← Alla ämnen</Link>
        {topic.icon && (
          <div className="topic-detail-icon" aria-hidden="true">
            <LucideIcon icon={topic.icon} className="topic-icon-svg" />
          </div>
        )}
        <h1>{topic.title}</h1>
        {topic.intro && <p>{topic.intro}</p>}
        {topic.published_at && (
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>
            Publicerad {formatDate(topic.published_at)}
          </p>
        )}
      </div>

      {topic.featured_image && (
        <img src={topic.featured_image} alt={topic.title} style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-7)' }} />
      )}

      {Array.isArray(topic.content) && topic.content.length > 0 ? (
        <ContentBlocks blocks={topic.content} />
      ) : (
        <p className="text-muted">Innehåll saknas för detta ämne.</p>
      )}
    </div>
  )
}
