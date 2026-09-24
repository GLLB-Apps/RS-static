import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { Topic, ContentBlock, ContentStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { slugify } from '../../lib/utils'
import TapEditor from '../../components/admin/TapEditor'
import ContentStats from '../../components/admin/ContentStats'
import IconPicker from '../../components/admin/IconPicker'
import { topicTemplateByKey } from '../../lib/topicTemplates'
import { useAutosave, useDraftRestore, clearDraft } from '../../lib/useAutosave'
import AutosaveBanner from '../../components/admin/AutosaveBanner'
import AutosaveStatus from '../../components/admin/AutosaveStatus'
import FocusModeToggle from '../../components/admin/FocusModeToggle'
import PreviewButton from '../../components/admin/PreviewButton'
import EditorLayout from '../../components/admin/EditorLayout'
import EditorSidebar from '../../components/admin/EditorSidebar'
import { useFocusMode } from '../../lib/focusMode'
import { FADE } from '../../lib/motionPresets'

interface TopicDraft {
  title: string
  slug: string
  intro: string
  content: ContentBlock[]
  status: ContentStatus
  featuredImage: string
  icon: string
  sortOrder: number
}

export default function AdminTopicEdit() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { show } = useToast()
  const { focusMode } = useFocusMode()
  const isNew = id === 'ny' || !id

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [intro, setIntro] = useState('')
  const [content, setContent] = useState<ContentBlock[]>([])
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [featuredImage, setFeaturedImage] = useState('')
  const [icon, setIcon] = useState<string>('')
  const [sortOrder, setSortOrder] = useState(0)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const draftKey = `topic:${id ?? 'new'}`
  const { draft, discard: discardDraft } = useDraftRestore<TopicDraft>(draftKey)
  const { dirty, savedAt } = useAutosave(draftKey, { title, slug, intro, content, status, featuredImage, icon, sortOrder }, { skip: loading })

  function restoreDraft() {
    if (!draft) return
    setTitle(draft.value.title)
    setSlug(draft.value.slug)
    setIntro(draft.value.intro)
    setContent(draft.value.content)
    setStatus(draft.value.status)
    setFeaturedImage(draft.value.featuredImage)
    setIcon(draft.value.icon)
    setSortOrder(draft.value.sortOrder)
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
    supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const t = data as Topic
          setTitle(t.title)
          setSlug(t.slug)
          setIntro(t.intro ?? '')
          setContent(Array.isArray(t.content) ? t.content : [])
          setStatus(t.status)
          setFeaturedImage(t.featured_image ?? '')
          setIcon(t.icon ?? '')
          setSortOrder(t.sort_order)
        }
        setLoading(false)
      })
  }, [id, isNew])

  // Prefill from a template when creating a new topic via "Skapa ny från mall".
  useEffect(() => {
    if (!isNew) return
    const tpl = topicTemplateByKey(searchParams.get('mall') ?? '')
    if (!tpl || tpl.key === 'blank') return
    setTitle(tpl.title)
    setSlug(slugify(tpl.title))
    setIntro(tpl.intro)
    setContent(tpl.content)
    setIcon(tpl.icon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (isNew || !slug) setSlug(slugify(value))
  }

  async function save(publish = false) {
    if (!title.trim()) {
      show('Titel krävs', 'error')
      return
    }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    const payload = {
      title,
      slug: slug || slugify(title),
      intro: intro || null,
      content,
      status: saveStatus,
      featured_image: featuredImage || null,
      icon: icon || null,
      sort_order: sortOrder,
      updated_by: user?.id,
      published_at: publish ? new Date().toISOString() : null,
    }

    if (isNew) {
      const { error } = await supabase.from('topics').insert({
        ...payload,
        created_by: user?.id,
      })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else {
        clearDraft(draftKey)
        show('Ämne skapat', 'success')
        navigate('/admin/amnen')
      }
    } else {
      const { error } = await supabase.from('topics').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { clearDraft(draftKey); show(publish ? 'Publicerad' : 'Sparat', 'success') }
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <AnimatePresence initial={false}>
          {!focusMode && (
            <motion.h1 key="title" {...FADE}>
              {isNew ? 'Nytt ämne' : 'Redigera ämne'}{!isNew && title && <span className="admin-edit-subject"> — {title}</span>}
            </motion.h1>
          )}
        </AnimatePresence>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'auto' }}>
          <AutosaveStatus dirty={dirty} savedAt={savedAt} />
          <AnimatePresence initial={false}>
            {focusMode && (
              <motion.div key="focus-actions" style={{ display: 'flex', gap: 'var(--space-2)' }} {...FADE}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => save(false)} disabled={saving}>
                  {saving ? 'Sparar…' : 'Spara'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => save(true)} disabled={saving}>
                  Publicera
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <PreviewButton getPayload={() => ({ title, intro, blocks: content })} />
          <FocusModeToggle />
          <AnimatePresence initial={false}>
            {!focusMode && (
              <motion.div key="back" {...FADE}>
                <Link to="/admin/amnen" className="btn btn-ghost btn-sm">← Tillbaka</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {draft && <AutosaveBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />}

      <EditorLayout>
        <div className="editor-main">
          <input
            className="editor-title-input"
            type="text"
            placeholder="Lägg till titel"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
          />
          <textarea
            className="editor-excerpt-input"
            rows={2}
            placeholder="Skriv en kort ingress (valfritt)"
            value={intro}
            onChange={e => setIntro(e.target.value)}
          />
          <TapEditor blocks={content} onChange={setContent} />
        </div>

        <EditorSidebar>
          <div className="editor-panel">
            <h3>Publicering</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" className="form-select" value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
                <option value="draft">Utkast</option>
                <option value="review">Väntar på granskning</option>
                <option value="published">Publicerad</option>
                <option value="archived">Arkiverad</option>
              </select>
            </div>
            <div className="editor-panel-actions">
              <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
                {saving ? 'Sparar…' : 'Spara som utkast'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>
                Publicera
              </button>
            </div>
          </div>

          <div className="editor-panel">
            <h3>Detaljer</h3>
            <div className="form-group">
              <label className="form-label">Ikon</label>
              <IconPicker value={icon || null} onChange={n => setIcon(n ?? '')} />
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 'var(--space-2)' }}>
                Ikonen visas på ämnessidan och i ämneskorten.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="slug">URL-slug</label>
              <input id="slug" className="form-input" type="text" value={slug} onChange={e => setSlug(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="featuredImage">Huvudbild (URL)</label>
              <input id="featuredImage" className="form-input" type="url" value={featuredImage} onChange={e => setFeaturedImage(e.target.value)} />
              {featuredImage && <img src={featuredImage} alt="" className="editor-image-preview" />}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sortOrder">Sorteringsordning</label>
              <input id="sortOrder" className="form-input" type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
          </div>

          <ContentStats blocks={content} />
        </EditorSidebar>
      </EditorLayout>
    </div>
  )
}
