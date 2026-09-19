import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import AvatarFacepile from '../../components/AvatarFacepile'
import { Link, useSearchParams } from 'react-router-dom'
import type { Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { firstContentImage, formatDateShort, truncate } from '../../lib/utils'
import {
  DEFAULT_NEWS_CATEGORY, NEWS_CATEGORIES, centerWeighted, newsCategoryBadge, newsCategoryLabel, postTags, tagCloud,
} from '../../lib/newsCategories'

const categoryOf = (post: Post) => post.category ?? DEFAULT_NEWS_CATEGORY

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  // Filtret ligger i adressen (?kategori=pressklipp&tagg=…) så att en menypost
  // kan peka rakt på t.ex. pressklippen, och så att ett filtrerat urval går att
  // dela med en länk.
  const [params, setParams] = useSearchParams()
  const category = NEWS_CATEGORIES.some(c => c.key === params.get('kategori')) ? params.get('kategori')! : ''
  const tag = params.get('tagg') ?? ''

  function setFilter(next: { kategori?: string; tagg?: string }) {
    const updated = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) updated.set(key, value)
      else updated.delete(key)
    }
    setParams(updated, { replace: true })
  }

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data as Post[] ?? [])
        setLoading(false)
      })
  }, [])

  // Kategorierna filtrerar molnet och tvärtom, så att kombinationen alltid ger
  // träffar: taggmolnet visar taggarna inom vald kategori.
  const inCategory = useMemo(
    () => (category ? posts.filter(p => categoryOf(p) === category) : posts),
    [posts, category],
  )
  const cloud = useMemo(() => tagCloud(inCategory), [inCategory])
  const shown = useMemo(
    () => (tag ? inCategory.filter(p => postTags(p).some(t => t.toLowerCase() === tag.toLowerCase())) : inCategory),
    [inCategory, tag],
  )
  // Redaktionens blobbar: kontona (garanterat riktiga admin-roller — bara de
  // kan skapa inlägg) som faktiskt skrivit något publicerat. Förankat till
  // konto-id:t, inte namnet, precis som vittnesmålens facepile.
  const editorSeeds = useMemo(
    () => Array.from(new Set(posts.map(p => p.created_by).filter((id): id is string => !!id))),
    [posts],
  )

  // Byte av kategori nollställer taggen – annars kan kombinationen bli tom.
  const pickCategory = (key: string) => setFilter({ kategori: category === key ? '' : key, tagg: '' })
  const pickTag = (name: string) => setFilter({ tagg: tag.toLowerCase() === name.toLowerCase() ? '' : name })

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const counts = new Map<string, number>()
  for (const p of posts) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1)

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader
          slug="nyheter"
          titleExtra={editorSeeds.length > 0 && (
            <div className="news-editors" title="Redaktionen">
              <AvatarFacepile seeds={editorSeeds} size={36} />
              <span className="news-editors-label">Redaktionen</span>
            </div>
          )}
        />
      </div>

      {posts.length > 0 && (
        <div className="news-filters">
          <div className="filter-chips">
            <button type="button" className={`filter-chip${category === '' ? ' is-active' : ''}`} onClick={() => pickCategory('')}>
              Allt <span className="filter-chip-count">{posts.length}</span>
            </button>
            {NEWS_CATEGORIES.map(c => {
              const count = counts.get(c.key) ?? 0
              if (count === 0) return null
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`filter-chip${category === c.key ? ' is-active' : ''}`}
                  onClick={() => pickCategory(c.key)}
                >
                  {c.label} <span className="filter-chip-count">{count}</span>
                </button>
              )
            })}
          </div>

          {cloud.length > 0 && (
            <div className="tag-cloud" role="group" aria-label="Filtrera på tagg">
              {centerWeighted(cloud).map(({ tag: name, count, weight }) => {
                const active = tag.toLowerCase() === name.toLowerCase()
                // Storleken bär antalet; färgen förstärker bara samma sak i tre steg.
                const tier = weight >= 0.999 ? 'top' : weight > 0 ? 'mid' : 'tail'
                return (
                  <button
                    key={name}
                    type="button"
                    className={`tag-cloud-item tag-tier-${tier}${active ? ' is-active' : ''}`}
                    style={{ fontSize: `${0.85 + weight * 1.05}rem` }}
                    onClick={() => pickTag(name)}
                    aria-pressed={active}
                    aria-label={`${name}, ${count} inlägg`}
                  >
                    {name}
                    <span className="tag-cloud-count" aria-hidden="true">{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {(category || tag) && (
            <button type="button" className="section-link news-filter-clear" onClick={() => setFilter({ kategori: '', tagg: '' })}>
              Rensa filter ✕
            </button>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty-state">
          <p>{posts.length === 0 ? 'Inga nyheter är publicerade ännu.' : 'Inget matchar filtret.'}</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginBottom: 'var(--space-9)' }}>
          {shown.map(post => {
            const image = post.featured_image ?? firstContentImage(post.content)
            return (
              <Link key={post.id} to={`/nyheter/${post.slug}`} className="card card-clickable news-card">
                {image && (
                  <img src={image} alt="" className="news-card-image" />
                )}
                <div className="news-card-meta">
                  <span className={newsCategoryBadge(categoryOf(post))}>{newsCategoryLabel(categoryOf(post))}</span>
                  <span className="news-card-date">{formatDateShort(post.published_at)}</span>
                  {post.is_pinned && <span className="badge badge-warning">Fäst</span>}
                </div>
                <h3>{post.title}</h3>
                {post.source && <p className="news-card-source">Publicerat i {post.source}</p>}
                {post.excerpt && <p>{truncate(post.excerpt, 150)}</p>}
                {postTags(post).length > 0 && (
                  <div className="news-card-tags">
                    {postTags(post).map(t => <span key={t} className="tag-chip">{t}</span>)}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
