import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import type { Post, ContentBlock, ContentStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { slugify } from '../../lib/utils'
import { DEFAULT_NEWS_CATEGORY, NEWS_CATEGORIES, newsCategory, parseTags, postTags } from '../../lib/newsCategories'
import TapEditor from '../../components/admin/TapEditor'

// <input type="date"> vill ha YYYY-MM-DD; databasen sparar hela tidsstämpeln.
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')
function fromDateInput(value: string, previous: string | null): string | null {
  if (!value) return null
  // Behåll klockslaget om bara datumet ändrats, annars mitt på dagen så att
  // tidszonen inte kan putta datumet till dagen före.
  const prev = previous ? new Date(previous) : null
  const time = prev && toDateInput(previous) === value
    ? prev.toISOString().slice(10)
    : 'T12:00:00.000Z'
  return `${value}${time}`
}

export default function AdminNewsEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const isNew = id === 'ny' || !id

  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', author: '', featured_image: '', image_caption: '', is_pinned: false,
    category: DEFAULT_NEWS_CATEGORY, source: '', external_url: '',
  })
  const [tags, setTags] = useState('')
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [content, setContent] = useState<ContentBlock[]>([])
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase.from('posts').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        const p = data as Post
        setForm({
          title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', author: p.author ?? '',
          featured_image: p.featured_image ?? '', image_caption: p.image_caption ?? '', is_pinned: p.is_pinned,
          category: p.category ?? DEFAULT_NEWS_CATEGORY, source: p.source ?? '', external_url: p.external_url ?? '',
        })
        setTags(postTags(p).join(', '))
        setPublishedAt(p.published_at)
        setContent(Array.isArray(p.content) ? p.content : [])
        setStatus(p.status)
      }
      setLoading(false)
    })
  }, [id, isNew])

  function update(key: string, value: string | boolean) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'title' && (isNew || !prev.slug)) next.slug = slugify(value as string)
      return next
    })
  }

  async function save(publish = false) {
    if (!form.title.trim()) { show('Titel krävs', 'error'); return }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    // Publiceringsdatumet är redaktörens: sätt dagens datum först när något
    // publiceras utan datum, och rör det aldrig när en publicerad post sparas om.
    const published_at = publishedAt ?? (saveStatus === 'published' ? new Date().toISOString() : null)
    const payload = {
      title: form.title,
      slug: form.slug || slugify(form.title),
      excerpt: form.excerpt || null,
      content,
      featured_image: form.featured_image || null,
      image_caption: form.image_caption || null,
      author: form.author || null,
      category: form.category || DEFAULT_NEWS_CATEGORY,
      tags: parseTags(tags),
      source: form.source || null,
      external_url: form.external_url || null,
      status: saveStatus,
      is_pinned: form.is_pinned,
      updated_by: user?.id,
      published_at,
    }
    if (isNew) {
      const { error } = await supabase.from('posts').insert({ ...payload, created_by: user?.id })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { show('Nyhet skapad', 'success'); navigate('/admin/nyheter') }
    } else {
      const { error } = await supabase.from('posts').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show(publish ? 'Publicerad' : 'Sparat', 'success')
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>{isNew ? 'Ny nyhet' : 'Redigera nyhet'}{!isNew && form.title && <span className="admin-edit-subject"> — {form.title}</span>}</h1>
        <Link to="/admin/nyheter" className="btn btn-ghost btn-sm">← Tillbaka</Link>
      </div>

      <div className="editor-layout">
        <div className="editor-main">
          <input
            className="editor-title-input"
            type="text"
            placeholder="Lägg till titel"
            value={form.title}
            onChange={e => update('title', e.target.value)}
          />
          <textarea
            className="editor-excerpt-input"
            rows={2}
            placeholder="Skriv en kort ingress (valfritt)"
            value={form.excerpt}
            onChange={e => update('excerpt', e.target.value)}
          />
          <TapEditor blocks={content} onChange={setContent} />
        </div>

        <aside className="editor-sidebar">
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
            <div className="form-group">
              <label className="form-label" htmlFor="published_at">Publiceringsdatum</label>
              <input
                id="published_at"
                className="form-input"
                type="date"
                value={toDateInput(publishedAt)}
                onChange={e => setPublishedAt(fromDateInput(e.target.value, publishedAt))}
              />
              <p className="form-hint">
                Styr ordningen på nyhetssidan. Sätt det riktiga datumet när du lägger upp
                äldre material — tomt betyder att dagens datum sätts vid publicering.
              </p>
            </div>
            <div className="checkbox-group">
              <input id="is_pinned" type="checkbox" checked={form.is_pinned} onChange={e => update('is_pinned', e.target.checked)} />
              <label htmlFor="is_pinned" className="form-label" style={{ margin: 0 }}>Fäst högst upp</label>
            </div>
            <div className="editor-panel-actions">
              <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
                {saving ? 'Sparar…' : 'Spara utkast'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>
                Publicera
              </button>
            </div>
          </div>

          <div className="editor-panel">
            <h3>Kategori & taggar</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="category">Kategori</label>
              <select id="category" className="form-select" value={form.category} onChange={e => update('category', e.target.value)}>
                {NEWS_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <p className="form-hint">{newsCategory(form.category)?.hint}</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tags">Taggar</label>
              <input
                id="tags"
                className="form-input"
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="Rögle kloster, buller, samråd"
              />
              <p className="form-hint">Separera med komma. Taggarna blir klickbara i taggmolnet på nyhetssidan.</p>
              {parseTags(tags).length > 0 && (
                <div className="tag-chip-row">
                  {parseTags(tags).map(t => <span key={t} className="tag-chip">{t}</span>)}
                </div>
              )}
            </div>
          </div>

          <div className="editor-panel">
            <h3>Källa</h3>
            <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>
              För pressklipp, krönikor och annat som publicerats någon annanstans. Länken visas
              som en tydlig knapp överst i artikeln och på kortet i listan.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="source">Publicerat i</label>
              <input
                id="source"
                className="form-input"
                type="text"
                value={form.source}
                onChange={e => update('source', e.target.value)}
                placeholder="Sveriges Radio P4 Extra"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="external_url">Länk till originalet</label>
              <input
                id="external_url"
                className="form-input"
                type="url"
                value={form.external_url}
                onChange={e => update('external_url', e.target.value)}
                placeholder="https://sverigesradio.se/…"
              />
            </div>
          </div>

          <div className="editor-panel">
            <h3>Detaljer</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="slug">URL-slug</label>
              <input id="slug" className="form-input" type="text" value={form.slug} onChange={e => update('slug', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="author">Författare</label>
              <input id="author" className="form-input" type="text" value={form.author} onChange={e => update('author', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="featured_image">Huvudbild (URL)</label>
              <input id="featured_image" className="form-input" type="url" value={form.featured_image} onChange={e => update('featured_image', e.target.value)} />
              {form.featured_image && <img src={form.featured_image} alt="" className="editor-image-preview" />}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="image_caption">Bildtext</label>
              <input id="image_caption" className="form-input" type="text" value={form.image_caption} onChange={e => update('image_caption', e.target.value)} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
