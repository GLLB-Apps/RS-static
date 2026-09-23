import { useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface LightboxImage {
  url: string
  alt: string
  caption?: string
}

interface Props {
  images: LightboxImage[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

/**
 * Helskärmsvisning för en bild i en ImageGallery. Föräldern (ImageGallery)
 * äger monteringen — den här komponenten animerar bara sin egen exit via
 * motion.div, som ett AnimatePresence hos föräldern fångar upp.
 */
export default function Lightbox({ images, index, onClose, onIndexChange }: Props) {
  const hasMultiple = images.length > 1
  const current = images[index]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (hasMultiple && e.key === 'ArrowRight') onIndexChange((index + 1) % images.length)
      else if (hasMultiple && e.key === 'ArrowLeft') onIndexChange((index - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, images.length, hasMultiple, onClose, onIndexChange])

  // useLayoutEffect (inte useEffect) — låset måste sitta INNAN webbläsaren
  // hinner måla första bilden, annars syns en bildruta där sidan fortfarande
  // har sin rullningslist, som sedan försvinner och knuffar innehållet ett
  // par pixlar — det är den "blinkningen" precis när lightboxen öppnas.
  // Kompenserar bredden med padding-right så sidan inte alls ändrar bredd.
  useLayoutEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [])

  if (!current) return null

  return (
    <motion.div
      className="content-lightbox-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      aria-label="Bildvisning"
    >
      <button type="button" className="content-lightbox-close" onClick={onClose} aria-label="Stäng">
        <X size={22} aria-hidden="true" />
      </button>

      {hasMultiple && (
        <button
          type="button"
          className="content-lightbox-nav content-lightbox-nav-prev"
          onClick={e => { e.stopPropagation(); onIndexChange((index - 1 + images.length) % images.length) }}
          aria-label="Föregående bild"
        >
          <ChevronLeft size={28} aria-hidden="true" />
        </button>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.figure
          key={index}
          className="content-lightbox-figure"
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15 }}
        >
          <img src={current.url} alt={current.alt} decoding="async" />
          {current.caption && <figcaption className="content-lightbox-caption">{current.caption}</figcaption>}
        </motion.figure>
      </AnimatePresence>

      {hasMultiple && (
        <button
          type="button"
          className="content-lightbox-nav content-lightbox-nav-next"
          onClick={e => { e.stopPropagation(); onIndexChange((index + 1) % images.length) }}
          aria-label="Nästa bild"
        >
          <ChevronRight size={28} aria-hidden="true" />
        </button>
      )}

      {hasMultiple && (
        <div className="content-lightbox-counter">{index + 1} / {images.length}</div>
      )}
    </motion.div>
  )
}
