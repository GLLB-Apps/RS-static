import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { ContentBlock } from '../../lib/types'
import Lightbox from './Lightbox'

/**
 * Ett eller flera intilliggande 'image'-block i innehållet (se ContentBlocks
 * i blocks.tsx, som grupperar dem hit innan de renderas). En ensam bild får
 * en enkel themad ram; två eller fler läggs i ett masonry-rutnät som anpassar
 * sig efter antalet. Klick öppnar en helskärmslightbox med </>-navigering.
 */
export default function ImageGallery({ blocks }: { blocks: ContentBlock[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const items = blocks.filter(b => b.image_url)
  if (!items.length) return null

  const columnClass = items.length === 1 ? 'image-gallery-1' : items.length === 2 ? 'image-gallery-2' : 'image-gallery-3plus'

  return (
    <>
      <div className={`image-gallery ${columnClass}`}>
        {items.map((block, i) => (
          <button
            key={i}
            type="button"
            className="image-gallery-item"
            onClick={() => setOpenIndex(i)}
            aria-label={block.text ? `Visa bild i helskärm: ${block.text}` : 'Visa bild i helskärm'}
          >
            <img src={block.image_url} alt={block.alt_text ?? ''} loading="lazy" />
            {block.text && <span className="image-gallery-caption">{block.text}</span>}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {openIndex !== null && (
          <Lightbox
            key="lightbox"
            images={items.map(b => ({ url: b.image_url ?? '', alt: b.alt_text ?? '', caption: b.text || undefined }))}
            index={openIndex}
            onClose={() => setOpenIndex(null)}
            onIndexChange={setOpenIndex}
          />
        )}
      </AnimatePresence>
    </>
  )
}
