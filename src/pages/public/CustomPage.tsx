import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CustomPage as CustomPageType } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { ContentBlocks } from '../../components/public/blocks'

export default function CustomPage() {
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState<CustomPageType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setPage(null)
    supabase.from('custom_pages').select('*').eq('slug', slug ?? '').eq('status', 'published').maybeSingle()
      .then(({ data }) => { setPage(data as CustomPageType | null); setLoading(false) })
  }, [slug])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!page) {
    return (
      <div className="notfound">
        <div className="notfound-badge" aria-hidden="true">404</div>
        <h1 className="notfound-title">Här växer bara skog</h1>
        <p className="notfound-text">Sidan du letade efter finns inte – eller så har den flyttat.</p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">Till startsidan</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container fade-in">
      <div className="page-header">
        <h1>{page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>
      {Array.isArray(page.blocks) && page.blocks.length > 0 && (
        <div style={{ marginBottom: 'var(--space-7)' }}>
          <ContentBlocks blocks={page.blocks} />
        </div>
      )}
    </div>
  )
}
