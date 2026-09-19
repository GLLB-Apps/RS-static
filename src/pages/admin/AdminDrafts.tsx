import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ContentStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { useMarkSourceRead } from '../../lib/notifications'
import { statusLabel, statusBadgeClass } from '../../lib/utils'
import {
  DRAFT_SOURCES, DRAFT_STATUSES, DRAFT_SORT_LABELS, sortDrafts,
  type DraftItem, type DraftSort,
} from '../../lib/drafts'

type Scope = 'all' | 'mine'

export default function AdminDrafts() {
  const { user } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [items, setItems] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('all')
  const [sort, setSort] = useState<DraftSort>('updated_desc')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)
  useMarkSourceRead('drafts', !loading)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    Promise.all(DRAFT_SOURCES.map(s => supabase.from(s.table).select('*').order('updated_at', { ascending: false })))
      .then(results => {
        const all: DraftItem[] = []
        results.forEach((res, i) => {
          const source = DRAFT_SOURCES[i]
          for (const row of (res.data ?? []) as Record<string, string>[]) {
            if (!DRAFT_STATUSES.includes(row.status as ContentStatus)) continue
            all.push({
              id: row.id,
              table: source.table,
              label: source.label,
              title: (row[source.titleField] || '').trim() || '(utan titel)',
              status: row.status as ContentStatus,
              updated_at: row.updated_at,
              created_by: row.created_by ?? null,
              editPath: source.editPath(row.id),
              hasAuthor: source.hasAuthor,
            })
          }
        })
        setItems(all)
        setLoading(false)
      })
  }

  const visible = useMemo(() => {
    let list = items
    if (scope === 'mine') list = list.filter(i => i.hasAuthor && i.created_by && i.created_by === user?.id)
    if (typeFilter) list = list.filter(i => i.table === typeFilter)
    return sortDrafts(list, sort)
  }, [items, scope, sort, typeFilter, user])

  const mineCount = useMemo(
    () => items.filter(i => i.hasAuthor && i.created_by && i.created_by === user?.id).length,
    [items, user],
  )

  /** Publicerar där utkastet hör hemma — samma kollektion, status "published". */
  async function publish(item: DraftItem) {
    if (!(await confirm({
      message: `Publicera "${item.title}"? Det blir synligt på webbplatsen direkt.`,
      confirmText: 'Publicera',
    }))) return
    setBusy(item.id)
    const { error } = await supabase.from(item.table).update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_by: user?.id,
    }).eq('id', item.id)
    setBusy(null)
    if (error) show('Kunde inte publicera: ' + error.message, 'error')
    else { show(`${item.label} publicerad`, 'success'); load() }
  }

  async function remove(item: DraftItem) {
    if (!(await confirm({
      message: `Ta bort utkastet "${item.title}"? Det går inte att ångra.`,
      confirmText: 'Ta bort',
      danger: true,
    }))) return
    setBusy(item.id)
    const { error } = await supabase.from(item.table).delete().eq('id', item.id)
    setBusy(null)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Utkast borttaget', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const usedTypes = DRAFT_SOURCES.filter(s => items.some(i => i.table === s.table))

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Utkast</h1>
      </div>

      <p className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>
        Allt osparat och opublicerat innehåll i systemet, samlat på ett ställe. Publicera direkt härifrån
        eller öppna för att redigera vidare.
      </p>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'tab active' : 'tab'} onClick={() => setScope('all')}>
          Alla utkast{items.length ? ` (${items.length})` : ''}
        </button>
        <button role="tab" aria-selected={scope === 'mine'} className={scope === 'mine' ? 'tab active' : 'tab'} onClick={() => setScope('mine')}>
          Mina utkast{mineCount ? ` (${mineCount})` : ''}
        </button>
      </div>

      <div className="admin-filter-bar">
        <label className="admin-filter-field">
          <span>Sortera</span>
          <select className="form-select" value={sort} onChange={e => setSort(e.target.value as DraftSort)}>
            {(Object.keys(DRAFT_SORT_LABELS) as DraftSort[]).map(key => (
              <option key={key} value={key}>{DRAFT_SORT_LABELS[key]}</option>
            ))}
          </select>
        </label>
        <label className="admin-filter-field">
          <span>Innehållstyp</span>
          <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Alla typer</option>
            {usedTypes.map(s => (
              <option key={s.table} value={s.table}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>{scope === 'mine' ? 'Du har inga egna utkast.' : 'Det finns inga utkast just nu.'}</p>
        </div>
      ) : (
        <div className="admin-list fade-in">
          {visible.map(item => (
            <div key={`${item.table}-${item.id}`} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{item.title}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</span>
                  <span>{item.label}</span>
                  <span>Ändrad {new Date(item.updated_at).toLocaleDateString('sv-SE')}</span>
                  {scope === 'all' && item.hasAuthor && item.created_by === user?.id && <span>· Mitt</span>}
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={item.editPath} className="btn btn-secondary btn-sm">Redigera</Link>
                <button className="btn btn-primary btn-sm" onClick={() => publish(item)} disabled={busy === item.id}>
                  Publicera
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(item)} disabled={busy === item.id}>
                  Ta bort
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
