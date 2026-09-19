import { useEffect, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import type { TimelineEvent } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('timeline_events')
      .select('*')
      .eq('status', 'published')
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        setEvents(data as TimelineEvent[] ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <PageHeader slug="tidslinje" />
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>Inga händelser har publicerats ännu.</p>
        </div>
      ) : (
        <div className="timeline" style={{ marginBottom: 'var(--space-9)' }}>
          {events.map(event => (
            <div key={event.id} className="timeline-item">
              <div className="timeline-date">{formatDate(event.event_date)}</div>
              <div className="timeline-title">{event.title}</div>
              {event.description && <div className="timeline-desc">{event.description}</div>}
              {event.event_type && <span className="badge badge-muted" style={{ marginTop: 'var(--space-2)' }}>{event.event_type}</span>}
              {event.link_url && (
                <a href={event.link_url} target="_blank" rel="noopener noreferrer" className="section-link" style={{ marginTop: 'var(--space-2)' }}>
                  Läs mer →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
