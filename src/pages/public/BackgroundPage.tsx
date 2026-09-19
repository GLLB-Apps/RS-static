import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { SiteSettings, ContentBlock } from '../../lib/types'
import PageHeader from '../../components/public/PageHeader'
import { RenderBlock } from '../../components/public/blocks'

export default function BackgroundPage() {
  const { settings } = useOutletContext<{ settings: SiteSettings | null }>()
  const [blocks, setBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    if (settings && Array.isArray(settings.background_blocks)) {
      setBlocks(settings.background_blocks)
    }
  }, [settings])

  const hasBlocks = blocks.length > 0

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <PageHeader slug="bakgrund" />
      </div>

      {hasBlocks ? (
        <div className="content-blocks" style={{ marginBottom: 'var(--space-9)' }}>
          {blocks.map((block, i) => (
            <RenderBlock key={i} block={block} />
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: 'var(--space-9)' }}>
          <p>Innehållet för den här sidan har inte lagts till ännu.</p>
        </div>
      )}
    </div>
  )
}
