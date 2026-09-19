import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDateShort, statusLabel, statusBadgeClass, senderTypeLabel } from '../../lib/utils'

export default function AdminDocuments() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('documents').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      setDocs(data as DocumentItem[] ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Dokument</h1>
        <Link to="/admin/dokument/ny" className="btn btn-primary btn-sm">Nytt dokument</Link>
      </div>
      {docs.length === 0 ? (
        <div className="empty-state"><p>Inga dokument finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {docs.map(d => (
            <div key={d.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{d.title}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(d.status)}>{statusLabel(d.status)}</span>
                  {d.sender_type && <span>{senderTypeLabel(d.sender_type)}</span>}
                  <span>{formatDateShort(d.document_date)}</span>
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={`/admin/dokument/${d.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
