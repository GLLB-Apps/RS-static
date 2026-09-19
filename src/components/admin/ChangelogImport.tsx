import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { fetchCommits, GITHUB_REPO, type GitHubCommit } from '../../lib/github'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../api/client'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { formatDateShort } from '../../lib/utils'

// Importerar commits från GitHub till ändringsloggen.
//
// Bara rubriken följer med — inte commit-texten, inte versioner, inte någon
// gissad typ. Rubrikerna översätts till svenska på vägen (commits skrivs på
// engelska för utvecklare, loggen läses på svenska av redaktionen) via
// /api/changelog/translate. Går översättningen inte att nå visas originalen
// och man får skriva om dem för hand — inget blockeras.
//
// Datumet kommer från commiten, eftersom loggen sorteras på det, och sha:t
// sparas så att redan importerade commits filtreras bort nästa gång.

interface Row {
  commit: GitHubCommit
  selected: boolean
  title: string
}

export default function ChangelogImport({ existingShas, onClose, onImported }: {
  /** Sha:n som redan finns i loggen — de visas inte igen. */
  existingShas: Set<string>
  onClose: () => void
  onImported: () => void
}) {
  const { user } = useAuth()
  const { show } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Hämtar commits…')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [translated, setTranslated] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const commits = (await fetchCommits(60)).filter(c => !existingShas.has(c.sha))
        if (!alive) return
        if (commits.length === 0) { setRows([]); setLoading(false); return }

        // Visa listan direkt med originalrubrikerna, och byt ut dem när
        // översättningen kommit — hellre något på skärmen än en tom väntan.
        setRows(commits.map(c => ({ commit: c, selected: true, title: c.subject })))
        setStatus(`Översätter ${commits.length} rubriker…`)

        const titles = await translate(commits.map(c => c.subject))
        if (!alive) return
        if (titles) {
          setRows(commits.map((c, i) => ({ commit: c, selected: true, title: titles[i] })))
          setTranslated(true)
        }
        setLoading(false)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    })()
    return () => { alive = false }
    // existingShas är en ny Set vid varje render hos föräldern — hämta en gång.

  }, [])

  /** null = översättningen gick inte att nå; då står originalrubrikerna kvar. */
  async function translate(subjects: string[]): Promise<string[] | null> {
    try {
      const data = await apiFetch<{ titles: string[] }>('/changelog/translate', { method: 'POST', body: { subjects } })
      return Array.isArray(data.titles) && data.titles.length === subjects.length ? data.titles : null
    } catch (e) {
      show('Kunde inte översätta: ' + (e instanceof Error ? e.message : String(e)) + '. Rubrikerna visas på engelska.', 'error')
      return null
    }
  }

  const selected = useMemo(() => rows.filter(r => r.selected), [rows])

  function patch(sha: string, changes: Partial<Row>) {
    setRows(prev => prev.map(r => r.commit.sha === sha ? { ...r, ...changes } : r))
  }

  async function save() {
    const valid = selected.filter(r => r.title.trim())
    if (valid.length === 0) { show('Inget att spara – bocka för minst en commit med rubrik', 'error'); return }
    setSaving(true)
    let ok = 0
    for (const r of valid) {
      const { error } = await supabase.from('changelog_entries').insert({
        title: r.title.trim(),
        entry_date: r.commit.date,
        commit_sha: r.commit.sha,
        created_by: user?.id ?? null,
        created_by_name: user?.email ?? null,
      })
      if (error) {
        setSaving(false)
        show(`Sparade ${ok} av ${valid.length}. Stoppade på "${r.title}": ${error.message}`, 'error')
        onImported()
        return
      }
      ok++
    }
    setSaving(false)
    show(`${ok} ${ok === 1 ? 'post' : 'poster'} lades till i ändringsloggen`, 'success')
    onImported()
    onClose()
  }

  return (
    <div className="admin-form-card changelog-import" style={{ marginBottom: 'var(--space-6)', maxWidth: 'none' }}>
      <div className="changelog-import-head">
        <div>
          <h3 style={{ margin: 0 }}>Hämta från GitHub</h3>
          <p className="form-hint" style={{ margin: 'var(--space-1) 0 0' }}>
            {GITHUB_REPO} · commits som inte redan finns i loggen. Rubrikerna översätts till
            svenska – bocka för det som ska med och justera texten om du vill.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Stäng</button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : error ? (
        <div className="empty-state"><p>{error}</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>Inga nya commits – loggen är i kapp med {GITHUB_REPO}.</p></div>
      ) : (
        <>
          <div className="changelog-import-actions">
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              {loading
                ? status
                : `${rows.length} nya ${rows.length === 1 ? 'commit' : 'commits'} · ${selected.length} valda${translated ? ' · översatta' : ''}`}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: true })))}>Markera alla</button>
            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}>Avmarkera alla</button>
          </div>

          <ul className="changelog-import-list">
            {rows.map(r => (
              <li key={r.commit.sha} className={r.selected ? 'changelog-import-row' : 'changelog-import-row is-off'}>
                <input
                  type="checkbox"
                  className="changelog-import-check"
                  checked={r.selected}
                  onChange={e => patch(r.commit.sha, { selected: e.target.checked })}
                  aria-label={`Ta med ${r.title}`}
                />
                <div className="changelog-import-body">
                  <div className="changelog-import-meta">
                    <span>{formatDateShort(r.commit.date)}</span>
                    <a href={r.commit.url} target="_blank" rel="noopener noreferrer" className="changelog-import-sha">
                      {r.commit.shortSha} <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </div>
                  <input
                    className="form-input"
                    type="text"
                    maxLength={200}
                    value={r.title}
                    disabled={!r.selected || loading}
                    onChange={e => patch(r.commit.sha, { title: e.target.value })}
                    aria-label="Rubrik i ändringsloggen"
                  />
                  {/* Originalet visas bara när rubriken skiljer sig – annars stod
                      samma text två gånger på varje rad. */}
                  {r.title.trim() !== r.commit.subject && (
                    <p className="changelog-import-original">↳ {r.commit.subject}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="admin-form-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving || loading || selected.length === 0}>
              {saving ? 'Sparar…' : `Spara ${selected.length} ${selected.length === 1 ? 'vald post' : 'valda poster'}`}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Avbryt</button>
          </div>
        </>
      )}
    </div>
  )
}
