import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { CustomPage, ContentBlock, ContentStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { RESERVED_SLUGS, slugify } from '../../lib/pages'
import TapEditor from '../../components/admin/TapEditor'
import ContentStats from '../../components/admin/ContentStats'
import { useAutosave, useDraftRestore, clearDraft } from '../../lib/useAutosave'
import AutosaveBanner from '../../components/admin/AutosaveBanner'
import AutosaveStatus from '../../components/admin/AutosaveStatus'
import FocusModeToggle from '../../components/admin/FocusModeToggle'
import EditorLayout from '../../components/admin/EditorLayout'
import EditorSidebar from '../../components/admin/EditorSidebar'
import { useFocusMode } from '../../lib/focusMode'
import { FADE } from '../../lib/motionPresets'

interface CustomPageDraft {
  title: string
  slug: string
  intro: string
  status: ContentStatus
  blocks: ContentBlock[]
}

export default function AdminCustomPageEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { show } = useToast()
  const { focusMode } = useFocusMode()
  const isNew = id === 'ny' || !id

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [intro, setIntro] = useState('')
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const draftKey = `custom-page:${id ?? 'new'}`
  const { draft, discard: discardDraft } = useDraftRestore<CustomPageDraft>(draftKey)
  const { dirty, savedAt } = useAutosave(draftKey, { title, slug, intro, status, blocks }, { skip: loading })

  function restoreDraft() {
    if (!draft) return
    setTitle(draft.value.title)
    setSlug(draft.value.slug)
    setSlugTouched(true)
    setIntro(draft.value.intro)
    setStatus(draft.value.status)
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
    if (isNew) return
    supabase.from('custom_pages').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      const p = data as CustomPage | null
      if (p) {
        setTitle(p.title ?? '')
        setSlug(p.slug ?? '')
        setIntro(p.intro ?? '')
        setStatus(p.status)
        setBlocks(Array.isArray(p.blocks) ? p.blocks : [])
      }
      setLoading(false)
    })
  }, [id, isNew])

  function onTitle(v: string) {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function save(publish?: boolean) {
    const finalSlug = slugify(slug)
    if (!title.trim()) { show('Titel krävs', 'error'); return }
    if (!finalSlug) { show('Adress (slug) krävs', 'error'); return }
    if (RESERVED_SLUGS.has(finalSlug)) { show(`Adressen /${finalSlug} är reserverad – välj en annan`, 'error'); return }

    // Unik slug bland egna sidor.
    const { data: clash } = await supabase.from('custom_pages').select('*').eq('slug', finalSlug).maybeSingle()
    if (clash && (clash as CustomPage).id !== id) { show(`Adressen /${finalSlug} används redan`, 'error'); return }

    setSaving(true)
    const saveStatus: ContentStatus = publish ? 'published' : status
    const payload = {
      title: title.trim(),
      slug: finalSlug,
      intro: intro || null,
      blocks,
      status: saveStatus,
      updated_by: user?.id,
      published_at: saveStatus === 'published' ? new Date().toISOString() : null,
    }
    if (isNew) {
      const { error } = await supabase.from('custom_pages').insert({ ...payload, created_by: user?.id, sort_order: 0 })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { clearDraft(draftKey); show('Sidan skapad', 'success'); navigate('/admin/egna-sidor') }
    } else {
      const { error } = await supabase.from('custom_pages').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { clearDraft(draftKey); setStatus(saveStatus); setSlug(finalSlug); show(publish ? 'Publicerad' : 'Sparat', 'success') }
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <AnimatePresence initial={false}>
          {!focusMode && (
            <motion.h1 key="title" {...FADE}>
              {isNew ? 'Ny sida' : 'Redigera sida'}{!isNew && title && <span className="admin-edit-subject"> — {title}</span>}
            </motion.h1>
          )}
        </AnimatePresence>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'auto' }}>
          <AutosaveStatus dirty={dirty} savedAt={savedAt} />
          <FocusModeToggle />
          <AnimatePresence initial={false}>
            {!focusMode && (
              <motion.div key="back" {...FADE}>
                <Link to="/admin/egna-sidor" className="btn btn-ghost btn-sm">← Alla fristående sidor</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {draft && <AutosaveBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />}

      <EditorLayout>
        <div className="editor-main">
          <div className="admin-form-card" style={{ maxWidth: 'none' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="title">Titel</label>
              <input id="title" className="form-input" type="text" value={title} onChange={e => onTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="intro">Ingress (valfritt)</label>
              <textarea id="intro" className="form-textarea" rows={2} value={intro} onChange={e => setIntro(e.target.value)} />
            </div>

            <h3 style={{ margin: 'var(--space-5) 0 var(--space-3)', fontSize: '0.95rem' }}>Sidans innehåll</h3>
            <TapEditor blocks={blocks} onChange={setBlocks} />

            <div className="admin-form-actions" style={{ marginTop: 'var(--space-5)' }}>
              <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
              <button className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>Publicera</button>
            </div>
          </div>
        </div>

        <EditorSidebar>
          <div className="editor-panel">
            <h3>Publicering</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" className="form-select" value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
                <option value="draft">Utkast</option>
                <option value="published">Publicerad</option>
                <option value="archived">Arkiverad</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="slug">Adress</label>
              <div className="custom-page-slug">
                <span>/</span>
                <input id="slug" className="form-input" type="text" value={slug} onChange={e => { setSlug(e.target.value); setSlugTouched(true) }} placeholder="om-oss" />
              </div>
              <p className="form-hint">Sidans publika adress. Reserverade namn (karta, nyheter …) går inte att använda.</p>
            </div>
            {!isNew && status === 'published' && (
              <a href={`/${slugify(slug)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Visa sidan →</a>
            )}
          </div>

          <ContentStats blocks={blocks} />
        </EditorSidebar>
      </EditorLayout>
    </div>
  )
}
