import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Topic } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort, statusLabel, statusBadgeClass } from '../../lib/utils'
import { TOPIC_TEMPLATES } from '../../lib/topicTemplates'
import LucideIcon from '../../lib/lucide'

export default function AdminTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const { confirm } = useConfirm()

  function load() {
    setLoading(true)
    supabase.from('topics').select('*').order('sort_order').then(({ data }) => {
      setTopics(data as Topic[] ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  async function remove(id: string, title: string) {
    if (!(await confirm({ message: `Ta bort ämnet "${title}" permanent?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('topics').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Ämnet borttaget', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Ämnesområden</h1>
        <Link to="/admin/amnen/ny" className="btn btn-primary btn-sm">Nytt ämne</Link>
      </div>

      <div className="template-picker">
        <h2 className="template-picker-title">Skapa nytt ämne från mall</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: '0 0 var(--space-3)' }}>
          Välj en mall för att börja med färdig rubrik, ingress och innehållsstruktur som du kan fylla i.
        </p>
        <div className="template-grid">
          {TOPIC_TEMPLATES.map(t => (
            <Link key={t.key} to={`/admin/amnen/ny?mall=${t.key}`} className="template-card">
              <span className="template-card-icon">
                {t.icon ? <LucideIcon icon={t.icon} size={24} /> : <span className="template-card-blank" aria-hidden="true">+</span>}
              </span>
              <span className="template-card-name">{t.name}</span>
              <span className="template-card-desc">{t.description}</span>
            </Link>
          ))}
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="empty-state"><p>Inga ämnen finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {topics.map(t => (
            <div key={t.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{t.title}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(t.status)}>{statusLabel(t.status)}</span>
                  <span>/{t.slug}</span>
                  <span>Uppdaterad {formatDateShort(t.updated_at)}</span>
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={`/admin/amnen/${t.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(t.id, t.title)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
