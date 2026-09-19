import { Link } from 'react-router-dom'
import { PAGES } from '../../lib/pages'

export default function AdminPages() {
  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Sidor</h1>
      </div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        Redigera de fasta texterna (rubrik och ingress) på webbplatsens sidor. Det dynamiska
        innehållet på varje sida hanteras i respektive sektion — du hoppar dit från sidans redigering.
      </p>
      <div className="admin-list">
        {PAGES.map(p => (
          <div key={p.slug} className="admin-list-item">
            <div className="admin-list-item-info">
              <div className="admin-list-item-title">{p.label}</div>
              <div className="admin-list-item-meta">
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.route}</span>
              </div>
            </div>
            <div className="admin-table-actions">
              <a href={p.route} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Visa</a>
              <Link to={`/admin/sidor/${p.slug}`} className="btn btn-secondary btn-sm">Redigera</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
