import { useEffect, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import type { DocumentItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDateShort, senderTypeLabel, senderTypeBadge } from '../../lib/utils'
import PdfReader, { opensInline, type PdfDoc } from '../../components/public/PdfReader'

/** PDF:er går att läsa direkt på sidan; övriga filer laddas ner. */
const isPdf = (doc: DocumentItem) =>
  doc.file_type?.toUpperCase() === 'PDF' || /\.pdf($|[?#])/i.test(doc.file_url ?? '')

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reading, setReading] = useState<PdfDoc | null>(null)
  const [filters, setFilters] = useState({ sender_type: '', search: '', year: '' })

  useEffect(() => {
    let query = supabase.from('documents').select('*').eq('status', 'published').order('published_at', { ascending: false })
    if (filters.sender_type) query = query.eq('sender_type', filters.sender_type)
    if (filters.search) query = query.ilike('title', `%${filters.search}%`)
    if (filters.year) query = query.gte('document_date', `${filters.year}-01-01`).lte('document_date', `${filters.year}-12-31`)
    query.then(({ data }) => {
      setDocuments(data as DocumentItem[] ?? [])
      setLoading(false)
    })
  }, [filters])

  const years = Array.from(new Set(documents.map(d => d.document_date?.substring(0, 4)).filter(Boolean))).sort().reverse()

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader slug="dokument" />
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          type="search"
          placeholder="Sök dokument…"
          value={filters.search}
          onChange={e => { setFilters(prev => ({ ...prev, search: e.target.value })); setLoading(true) }}
        />
        <select
          className="form-select"
          value={filters.sender_type}
          onChange={e => setFilters(prev => ({ ...prev, sender_type: e.target.value }))}
          aria-label="Filtrera på avsändare"
        >
          <option value="">Alla avsändare</option>
          <option value="ncc">NCC</option>
          <option value="lund_kommun">Lunds kommun</option>
          <option value="authority">Myndighet</option>
          <option value="media">Media</option>
          <option value="initiative">Initiativet</option>
          <option value="private">Privatperson</option>
        </select>
        <select
          className="form-select"
          value={filters.year}
          onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))}
          aria-label="Filtrera på år"
        >
          <option value="">Alla år</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>Inga dokument hittades med dessa filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-9)' }}>
          {documents.map(doc => (
            <div key={doc.id} className="document-item">
              <div className="document-icon" aria-hidden="true">📄</div>
              <div className="document-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <h4>{doc.title}</h4>
                  {doc.sender_type && <span className={senderTypeBadge(doc.sender_type)}>{senderTypeLabel(doc.sender_type)}</span>}
                </div>
                {doc.description && <p>{doc.description}</p>}
                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                  {doc.document_date && <span>{formatDateShort(doc.document_date)}</span>}
                  {doc.file_type && <span>{doc.file_type}</span>}
                  {doc.sender && <span>Från: {doc.sender}</span>}
                </div>
              </div>
              <div className="document-actions">
                {doc.file_url && isPdf(doc) && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (opensInline()) setReading({ title: doc.title, url: doc.file_url! })
                        else window.open(doc.file_url!, '_blank', 'noopener')
                      }}
                    >
                      Läs
                    </button>
                    <a href={doc.file_url} download className="btn btn-ghost btn-sm">Ladda ner</a>
                  </>
                )}
                {doc.file_url && !isPdf(doc) && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Ladda ner</a>
                )}
                {doc.external_url && !doc.file_url && (
                  <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Öppna länk</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PdfReader doc={reading} onClose={() => setReading(null)} />
    </div>
  )
}
