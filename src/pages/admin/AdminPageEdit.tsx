import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import type { ContentBlock } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { pageBySlug } from '../../lib/pages'
import TapEditor from '../../components/admin/TapEditor'
import ContentStats from '../../components/admin/ContentStats'
import { useAutosave, useDraftRestore, clearDraft } from '../../lib/useAutosave'
import AutosaveBanner from '../../components/admin/AutosaveBanner'
import AutosaveStatus from '../../components/admin/AutosaveStatus'

interface PageDraft {
  title: string
  intro: string
  texts: Record<string, string>
  blocks: ContentBlock[]
}

export default function AdminPageEdit() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const cfg = slug ? pageBySlug(slug) : undefined
  const { show } = useToast()
  const [title, setTitle] = useState('')
  const [intro, setIntro] = useState('')
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const draftKey = `page:${slug ?? 'unknown'}`
  const { draft, discard: discardDraft } = useDraftRestore<PageDraft>(draftKey)
  const { dirty, savedAt } = useAutosave(draftKey, { title, intro, texts, blocks }, { skip: loading })

  function restoreDraft() {
    if (!draft) return
    setTitle(draft.value.title)
    setIntro(draft.value.intro)
    setTexts(draft.value.texts)
    setBlocks(draft.value.blocks)
    discardDraft()
  }

  // Kom hit via DraftRecoveryDialog.tsx (den globala "Välkommen tillbaka"-
  // dialogen) — återställ automatiskt, men först när sidans egna data hunnit
  // laddas in (annars skriver den laddningen över återställningen).
  useEffect(() => {
    if (loading) return
    if (location.state?.autoRestoreDraft) restoreDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (!slug) return
    supabase.from('pages').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      const d = data as { title?: string; intro?: string; texts?: Record<string, string>; blocks?: ContentBlock[] } | null
      setTitle(d?.title ?? cfg?.defaultTitle ?? '')
      setIntro(d?.intro ?? cfg?.defaultIntro ?? '')
      const base: Record<string, string> = {}
      for (const f of cfg?.fields ?? []) base[f.key] = d?.texts?.[f.key] ?? f.default
      setTexts(base)
      setBlocks(Array.isArray(d?.blocks) ? d.blocks : [])
      setLoading(false)
    })
  }, [slug])

  async function save() {
    setSaving(true)
    const payload: Record<string, unknown> = { id: slug, slug, title, intro, texts }
    if (cfg?.hasBlocks) payload.blocks = blocks
    const { error } = await supabase.from('pages').upsert(payload)
    setSaving(false)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else { clearDraft(draftKey); show('Sparat', 'success') }
  }

  if (!cfg) return <div className="empty-state"><p>Okänd sida.</p></div>
  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Redigera sida<span className="admin-edit-subject"> — {cfg.label}</span></h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <AutosaveStatus dirty={dirty} savedAt={savedAt} />
          <Link to="/admin/sidor" className="btn btn-ghost btn-sm">← Alla sidor</Link>
        </div>
      </div>

      {draft && <AutosaveBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />}

      <div className="editor-layout">
        <div className="editor-main">
          <div className="admin-form-card" style={{ maxWidth: 'none' }}>
            {!cfg.headerless && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="title">Rubrik</label>
                  <input id="title" className="form-input" type="text" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="intro">Ingress</label>
                  <textarea id="intro" className="form-textarea" rows={3} value={intro} onChange={e => setIntro(e.target.value)} />
                </div>
              </>
            )}

            {cfg.fields && cfg.fields.length > 0 && (
              <>
                {!cfg.headerless && <h3 style={{ margin: 'var(--space-5) 0 var(--space-3)', fontSize: '0.95rem' }}>Texter på sidan</h3>}
                {cfg.fields.map(f => (
                  <div className="form-group" key={f.key}>
                    <label className="form-label" htmlFor={`t_${f.key}`}>{f.label}</label>
                    {f.multiline ? (
                      <textarea id={`t_${f.key}`} className="form-textarea" rows={2} value={texts[f.key] ?? ''} onChange={e => setTexts(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    ) : (
                      <input
                        id={`t_${f.key}`}
                        className="form-input"
                        type={f.type === 'number' ? 'number' : 'text'}
                        min={f.type === 'number' ? 0 : undefined}
                        value={texts[f.key] ?? ''}
                        onChange={e => setTexts(prev => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                    {f.hint && <p className="form-hint">{f.hint}</p>}
                  </div>
                ))}
              </>
            )}

            {cfg.hasBlocks && (
              <>
                <h3 style={{ margin: 'var(--space-5) 0 var(--space-3)', fontSize: '0.95rem' }}>Sidans innehåll</h3>
                <TapEditor blocks={blocks} onChange={setBlocks} />
              </>
            )}

            <div className="admin-form-actions">
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
              <a href={cfg.route} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Visa sidan →</a>
            </div>
          </div>
        </div>

        <aside className="editor-sidebar">
          <div className="editor-panel">
            <h3>Dynamiskt innehåll</h3>
            {cfg.manage.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Den här sidan har inget dynamiskt innehåll att hantera.</p>
            ) : (
              <div className="editor-panel-actions">
                {cfg.manage.map(m => (
                  <Link key={m.to} to={m.to} className="btn btn-secondary">{m.label} →</Link>
                ))}
              </div>
            )}
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-3)' }}>
              Hoppa hit och tillbaka för att redigera både text och innehåll.
            </p>
          </div>

          <ContentStats blocks={blocks} />
        </aside>
      </div>
    </div>
  )
}
