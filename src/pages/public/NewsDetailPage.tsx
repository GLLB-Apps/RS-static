import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { newsCategoryBadge, newsCategoryLabel, postTags } from '../../lib/newsCategories'
import { RenderBlock } from '../../components/public/blocks'
import { useRegisterEditLink } from '../../lib/editLink'
import UserAvatar from '../../components/UserAvatar'

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        setPost(data as Post | null)
        setLoading(false)
      })
  }, [slug])

  useRegisterEditLink(post ? `/admin/nyheter/${post.id}` : null)

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!post) {
    return (
      <div className="empty-state">
        <h1>Nyheten hittades inte</h1>
        <Link to="/nyheter" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>Tillbaka till nyheter</Link>
      </div>
    )
  }

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <Link to="/nyheter" className="section-link" style={{ marginBottom: 'var(--space-3)' }}>← Alla nyheter</Link>
        <h1>{post.title}</h1>
        {post.excerpt && <p>{post.excerpt}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={newsCategoryBadge(post.category)}>{newsCategoryLabel(post.category)}</span>
          {post.published_at && <span className="text-muted" style={{ fontSize: '0.85rem' }}>{formatDate(post.published_at)}</span>}
          {post.author && (
            <span className="text-muted" style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {post.created_by && <UserAvatar seed={post.created_by} size={22} title="Skribent" />}
              Av {post.author}
            </span>
          )}
          {post.source && <span className="text-muted" style={{ fontSize: '0.85rem' }}>Publicerat i {post.source}</span>}
        </div>
      </div>

      {post.external_url && (
        <a href={post.external_url} target="_blank" rel="noopener noreferrer" className="block-button news-source-link">
          {post.source ? `Läs hela artikeln hos ${post.source} →` : 'Läs hela artikeln hos källan →'}
        </a>
      )}

      {post.featured_image && (
        <img src={post.featured_image} alt={post.image_caption ?? ''} style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-7)' }} />
      )}
      {post.image_caption && (
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '-var(--space-4)', marginBottom: 'var(--space-7)' }}>{post.image_caption}</p>
      )}

      {Array.isArray(post.content) && post.content.length > 0 ? (
        <div className="content-blocks">
          {post.content.map((block, i) => <RenderBlock key={i} block={block} />)}
        </div>
      ) : (
        // Ett pressklipp behöver ingen egen brödtext – källknappen är innehållet.
        !post.external_url && <p className="text-muted">Innehåll saknas.</p>
      )}

      {postTags(post).length > 0 && (
        <div className="news-card-tags" style={{ marginTop: 'var(--space-7)' }}>
          {postTags(post).map(t => <span key={t} className="tag-chip">{t}</span>)}
        </div>
      )}
    </div>
  )
}
