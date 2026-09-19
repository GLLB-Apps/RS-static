import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TimelineEvent } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDateShort, statusLabel, statusBadgeClass } from '../../lib/utils'

export default function AdminTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('timeline_events').select('*').order('event_date', { ascending: false }).then(({ data }) => {
      setEvents(data as TimelineEvent[] ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Tidslinje</h1>
        <Link to="/admin/tidslinje/ny" className="btn btn-primary btn-sm">Ny händelse</Link>
      </div>
      {events.length === 0 ? (
        <div className="empty-state"><p>Inga händelser finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {events.map(e => (
            <div key={e.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{e.title}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(e.status)}>{statusLabel(e.status)}</span>
                  <span>{formatDateShort(e.event_date)}</span>
                  {e.event_type && <span>{e.event_type}</span>}
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={`/admin/tidslinje/${e.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
