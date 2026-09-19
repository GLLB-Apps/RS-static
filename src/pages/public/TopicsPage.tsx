import { useEffect, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import { Link } from 'react-router-dom'
import type { Topic } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { truncate } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('topics')
      .select('*')
      .eq('status', 'published')
      .order('sort_order')
      .then(({ data }) => {
        setTopics(data as Topic[] ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader slug="amnen" />
      </div>

      {topics.length === 0 ? (
        <div className="empty-state">
          <p>Inga ämnen är publicerade ännu.</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 'var(--space-9)' }}>
          {topics.map(topic => (
            <Link key={topic.id} to={`/amnen/${topic.slug}`} className="card card-clickable topic-card">
              <div className="topic-card-icon">
                {topic.featured_image ? (
                  <img src={topic.featured_image} alt="" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                ) : (
                  <LucideIcon icon={topic.icon} className="topic-icon-svg" />
                )}
              </div>
              <h3>{topic.title}</h3>
              {topic.intro && <p>{truncate(topic.intro, 120)}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
