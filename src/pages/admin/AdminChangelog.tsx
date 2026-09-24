import { useEffect, useMemo, useState } from 'react'
import { GitCommitHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ChangelogCategory, ChangelogEntry } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDate, todayIso } from '../../lib/utils'
import ChangelogImport from '../../components/admin/ChangelogImport'

// Ändringslogg över systemet: vad som byggts, ändrats och rättats, med datum.
// Posterna sorteras på `entry_date` (inte på när raden skapades), så att man kan
// fylla på i efterhand och ändå få dem på rätt plats i historiken.
// Kollektionen läses bara av admin-labeln — loggen är ett internt verktyg.

const CATEGORIES: { value: ChangelogCategory; label: string; badge: string }[] = [
  { value: 'feature', label: 'Nytt', badge: 'badge-success' },
  { value: 'improvement', label: 'Förbättring', badge: 'badge-muted' },
  { value: 'fix', label: 'Rättning', badge: 'badge-warning' },
  { value: 'other', label: 'Övrigt', badge: 'badge-muted' },
]
const category = (v: string | null) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[3]

interface Draft {
  id: string | null
  title: string
  body: string
  entry_date: string
  category: ChangelogCategory
  version: string
}

const emptyDraft = (): Draft => ({
  id: null, title: '', body: '', entry_date: todayIso(), category: 'feature', version: '',
})

export default function AdminChangelog() {
  const { user } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [filter, setFilter] = useState<ChangelogCategory | 'all'>('all')
  const [importing, setImporting] = useState(false)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('changelog_entries').select('*').order('entry_date', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (error) show('Kunde inte hämta ändringsloggen: ' + error.message, 'error')
        setEntries((data as ChangelogEntry[]) ?? [])
        setLoading(false)
      })
  }

  // Redan importerade commits ska inte dyka upp i importlistan igen.
  const existingShas = useMemo(
    () => new Set(entries.map(e => e.commit_sha).filter(Boolean) as string[]),
    [entries],
  )

  const visible = useMemo(
    () => filter === 'all' ? entries : entries.filter(e => category(e.category).value === filter),
    [entries, filter],
  )

  // Posterna samlas per år, så att en lång logg går att överblicka.
  const byYear = useMemo(() => {
    const map = new Map<string, ChangelogEntry[]>()
    for (const e of visible) {
      const year = e.entry_date?.slice(0, 4) || 'Utan datum'
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(e)
    }
    return Array.from(map.entries())
  }, [visible])

  async function save() {
    if (!draft) return
    // commit_sha rör vi inte här: den sätts vid importen och ska följa med
    // posten även när rubriken skrivs om efteråt.
    if (!draft.title.trim()) { show('Rubriken behövs', 'error'); return }
    if (!draft.entry_date) { show('Datumet behövs', 'error'); return }
    setSaving(true)
    const payload = {
      title: draft.title.trim(),
      body: draft.body.trim() || null,
      entry_date: draft.entry_date,
      category: draft.category,
      version: draft.version.trim() || null,
    }
    const { error } = draft.id
      ? await supabase.from('changelog_entries').update(payload).eq('id', draft.id)
      : await supabase.from('changelog_entries').insert({
          ...payload,
          created_by: user?.id ?? null,
          created_by_name: user?.email ?? null,
        })
    setSaving(false)
    if (error) { show('Kunde inte spara: ' + error.message, 'error'); return }
    show(draft.id ? 'Posten uppdaterad' : 'Posten tillagd', 'success')
    setDraft(null)
    load()
  }

  async function remove(e: ChangelogEntry) {
    if (!(await confirm({ message: `Ta bort "${e.title}" ur ändringsloggen?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('changelog_entries').delete().eq('id', e.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    setEntries(prev => prev.filter(x => x.id !== e.id))
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Ändringslogg</h1>
        <div className="admin-table-actions">
          {!importing && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setDraft(null); setImporting(true) }}>
              <GitCommitHorizontal size={16} /> Hämta från GitHub
            </button>
          )}
          {!draft && (
            <button className="btn btn-primary btn-sm" onClick={() => { setImporting(false); setDraft(emptyDraft()) }}>
              <Plus size={16} /> Ny post
            </button>
          )}
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: '0.88rem', maxWidth: '68ch', marginTop: 0 }}>
        Historik över vad som hänt med systemet. Posterna sorteras på det datum du anger, inte på när
        de skrevs in – det går alltså bra att fylla på i efterhand. Loggen visas bara här i
        adminpanelen och syns aldrig publikt.
      </p>

      {importing && (
        <ChangelogImport
          existingShas={existingShas}
          onClose={() => setImporting(false)}
          onImported={load}
        />
      )}

      {draft && (
        <div className="admin-form-card" style={{ marginBottom: 'var(--space-6)', maxWidth: 'none' }}>
          <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>{draft.id ? 'Redigera post' : 'Ny post'}</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="cl_title">Rubrik</label>
            <input
              id="cl_title" className="form-input" type="text" maxLength={200} autoFocus
              placeholder="Vad ändrades?"
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="grid grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="cl_date">Datum</label>
              <input
                id="cl_date" className="form-input" type="date"
                value={draft.entry_date}
                onChange={e => setDraft({ ...draft, entry_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cl_category">Typ</label>
              <select
                id="cl_category" className="form-select"
                value={draft.category}
                onChange={e => setDraft({ ...draft, category: e.target.value as ChangelogCategory })}
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cl_version">Version (valfritt)</label>
              <input
                id="cl_version" className="form-input" type="text" maxLength={32} placeholder="t.ex. 1.4"
                value={draft.version}
                onChange={e => setDraft({ ...draft, version: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cl_body">Beskrivning (valfritt)</label>
            <textarea
              id="cl_body" className="form-textarea" rows={5} maxLength={5000}
              placeholder="Detaljer, bakgrund eller vad man behöver tänka på."
              value={draft.body}
              onChange={e => setDraft({ ...draft, body: e.target.value })}
            />
          </div>
          <div className="admin-form-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Sparar…' : draft.id ? 'Spara ändringar' : 'Lägg till'}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>Avbryt</button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="changelog-filters">
          <button
            className={filter === 'all' ? 'tab active' : 'tab'}
            onClick={() => setFilter('all')}
          >
            Alla ({entries.length})
          </button>
          {CATEGORIES.map(c => {
            const count = entries.filter(e => category(e.category).value === c.value).length
            if (count === 0) return null
            return (
              <button
                key={c.value}
                className={filter === c.value ? 'tab active' : 'tab'}
                onClick={() => setFilter(c.value)}
              >
                {c.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>{entries.length === 0 ? 'Ändringsloggen är tom. Lägg till den första posten.' : 'Inga poster av den typen.'}</p>
        </div>
      ) : (
        byYear.map(([year, items]) => (
          <section key={year} className="changelog-year">
            <h2 className="changelog-year-title">{year}</h2>
            <ol className="changelog-list">
              {items.map(e => {
                const cat = category(e.category)
                return (
                  <li key={e.id} className="changelog-item">
                    <div className="changelog-item-head">
                      <span className="changelog-date">{e.entry_date ? formatDate(e.entry_date) : 'Utan datum'}</span>
                      <span className={`badge ${cat.badge}`}>{cat.label}</span>
                      {e.version && <span className="changelog-version">v{e.version}</span>}
                      <div className="changelog-actions">
                        <button
                          className="intdoc-icon-btn"
                          data-tooltip="Redigera"
                          aria-label={`Redigera ${e.title}`}
                          onClick={() => setDraft({
                            id: e.id,
                            title: e.title,
                            body: e.body ?? '',
                            entry_date: e.entry_date ?? todayIso(),
                            category: category(e.category).value,
                            version: e.version ?? '',
                          })}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="intdoc-icon-btn danger"
                          data-tooltip="Ta bort"
                          aria-label={`Ta bort ${e.title}`}
                          onClick={() => remove(e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h3 className="changelog-title">{e.title}</h3>
                    {e.body && <p className="changelog-body">{e.body}</p>}
                    {(e.created_by_name || e.commit_sha) && (
                      <p className="changelog-by">
                        {e.commit_sha
                          ? <>Importerad från commit <code>{e.commit_sha.slice(0, 7)}</code></>
                          : <>Skrevs av {e.created_by_name}</>}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
