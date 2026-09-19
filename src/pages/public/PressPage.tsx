import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Post, DocumentItem, MediaItem, Contact } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate, formatDateShort, senderTypeLabel, senderTypeBadge } from '../../lib/utils'
import { usePage } from '../../lib/usePage'
import { ContentBlocks } from '../../components/public/blocks'

// Hur många rader som hämtas – vad som faktiskt visas styrs av de redigerbara
// fälten press_limit / docs_limit, så antalet kan ändras utan ny hämtning.
const POSTS_FETCH = 25
const DOCS_FETCH = 50

const toCount = (value: string, fallback: number) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export default function PressPage() {
  const page = usePage('press')
  const [posts, setPosts] = useState<Post[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [pressImages, setPressImages] = useState<MediaItem[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('posts').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(POSTS_FETCH),
      supabase.from('documents').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(DOCS_FETCH),
      supabase.from('media_items').select('*').eq('status', 'published').eq('is_press_allowed', true).order('published_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('is_public', true).order('sort_order'),
    ]).then(([p, d, m, c]) => {
      setPosts(p.data as Post[] ?? [])
      setDocuments(d.data as DocumentItem[] ?? [])
      setPressImages(m.data as MediaItem[] ?? [])
      setContacts(c.data as Contact[] ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const factsHeading = page.text('facts_heading')
  const facts = page.text('facts').split('\n').filter(Boolean)
  const shownPosts = posts.slice(0, toCount(page.text('press_limit'), 5))
  const shownDocs = documents.slice(0, toCount(page.text('docs_limit'), 10))
  const pressEmpty = page.text('press_empty')
  const pressLink = page.text('press_link')
  const docsEmpty = page.text('docs_empty')
  const docsLink = page.text('docs_link')
  const imagesNote = page.text('images_note')
  const imagesEmpty = page.text('images_empty')
  const downloadLabel = page.text('download_label')
  const updatedLabel = page.text('updated_label')
  const updatedValue = page.text('updated_value')

  return (
    <div className="container fade-in">
      <div className="page-header">
        <h1>{page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>

      {page.blocks.length > 0 && (
        <div style={{ marginBottom: 'var(--space-7)' }}>
          <ContentBlocks blocks={page.blocks} />
        </div>
      )}

      <div className="press-grid" style={{ marginBottom: 'var(--space-9)' }}>
        <div>
          {(factsHeading || facts.length > 0) && (
            <div className="press-card">
              {factsHeading && <h3>{factsHeading}</h3>}
              <ul style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {facts.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          )}

          {(shownPosts.length > 0 || pressEmpty) && (
            <div className="press-card">
              <h3>{page.text('press_heading')}</h3>
              {shownPosts.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>{pressEmpty}</p>
              ) : shownPosts.map(p => (
                <Link key={p.id} to={`/nyheter/${p.slug}`} className="press-item">
                  <p className="press-item-title">{p.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>{formatDateShort(p.published_at)}</p>
                </Link>
              ))}
              {pressLink && <Link to="/nyheter" className="section-link" style={{ marginTop: 'var(--space-3)' }}>{pressLink}</Link>}
            </div>
          )}

          {(shownDocs.length > 0 || docsEmpty) && (
            <div className="press-card">
              <h3>{page.text('docs_heading')}</h3>
              {shownDocs.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>{docsEmpty}</p>
              ) : shownDocs.map(d => {
                // Dokument har ingen egen sida – titeln länkar till filen, eller
                // till den externa källan när ingen fil är uppladdad.
                const href = d.file_url || d.external_url
                return (
                  <div key={d.id} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {href
                        ? <a href={href} target="_blank" rel="noopener noreferrer" className="press-item-title press-item-link">{d.title}</a>
                        : <span style={{ fontWeight: 500 }}>{d.title}</span>}
                      {d.sender_type && <span className={senderTypeBadge(d.sender_type)}>{senderTypeLabel(d.sender_type)}</span>}
                    </div>
                    {d.description && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{d.description}</p>}
                    {href && downloadLabel && <a href={href} target="_blank" rel="noopener noreferrer" className="section-link">{downloadLabel}</a>}
                  </div>
                )
              })}
              {docsLink && <Link to="/dokument" className="section-link" style={{ marginTop: 'var(--space-3)' }}>{docsLink}</Link>}
            </div>
          )}
        </div>

        <div>
          {(contacts.length > 0 || page.text('contacts_empty')) && (
            <div className="press-card">
              <h3>{page.text('contacts_heading')}</h3>
              {contacts.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>{page.text('contacts_empty')}</p>
              ) : contacts.map(c => (
                <div key={c.id} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-light)' }}>
                  <p style={{ fontWeight: 500 }}>{c.name}</p>
                  {c.role && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{c.role}</p>}
                  {c.email && <p style={{ fontSize: '0.85rem' }}><a href={`mailto:${c.email}`}>{c.email}</a></p>}
                  {c.phone && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{c.phone}</p>}
                </div>
              ))}
            </div>
          )}

          {(pressImages.length > 0 || imagesEmpty) && (
            <div className="press-card">
              <h3>{page.text('images_heading')}</h3>
              {imagesNote && <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{imagesNote}</p>}
              {pressImages.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>{imagesEmpty}</p>
              ) : (
                <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                  {pressImages.map(img => (
                    <div key={img.id}>
                      {img.file_url && <img src={img.file_url} alt={img.alt_text ?? img.title} style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />}
                      <p style={{ fontSize: '0.8rem', marginTop: 'var(--space-1)' }}>{img.title}</p>
                      {img.rights_info && <p className="text-muted" style={{ fontSize: '0.75rem' }}>{img.rights_info}</p>}
                      {img.file_url && downloadLabel && <a href={img.file_url} target="_blank" rel="noopener noreferrer" className="section-link" style={{ fontSize: '0.8rem' }}>{downloadLabel}</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {updatedLabel && (
            <div className="press-card">
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                {updatedLabel}: {updatedValue || formatDate(new Date().toISOString())}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
