import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import type { ContentBlock } from '../../lib/types'

/**
 * Ett eller flera intilliggande 'image'-block i innehållet (se ContentBlocks
 * i blocks.tsx, som grupperar dem hit innan de renderas). En ensam bild får
 * en enkel themad ram; två eller fler läggs i ett masonry-rutnät som anpassar
 * sig efter antalet. Klick öppnar en helskärmslightbox (yet-another-react-
 * lightbox — stabil, väl underhållen, noll extra beroenden) themad via
 * --yarl__*-variablerna i public.css i stället för en egenbyggd modal.
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
      <Lightbox
        open={openIndex !== null}
        close={() => setOpenIndex(null)}
        index={openIndex ?? 0}
        slides={items.map(b => ({
          src: b.image_url ?? '',
          alt: b.alt_text ?? '',
          description: b.text || undefined,
        }))}
        plugins={[Captions, Counter]}
        animation={{ fade: 200, swipe: 250 }}
      />
    </>
  )
}
