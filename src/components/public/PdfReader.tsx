import { useEffect } from 'react'

// Läsvy för PDF:er: öppnar dokumentet i en ruta ovanpå sidan i stället för att
// skicka besökaren till en nedladdning. Nedladdning finns kvar som eget val.
export interface PdfDoc { title: string; url: string }

/**
 * Mobila webbläsare (särskilt iOS) renderar inte PDF i en iframe – där öppnas
 * filen i en egen flik i stället.
 */
export function opensInline(): boolean {
  try { return window.matchMedia('(min-width: 769px)').matches } catch { return true }
}

export default function PdfReader({ doc, onClose }: { doc: PdfDoc | null; onClose: () => void }) {
  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [doc, onClose])

  if (!doc) return null

  return (
    <div className="pdf-reader" role="dialog" aria-modal="true" aria-label={doc.title} onClick={onClose}>
      <div className="pdf-reader-panel" onClick={e => e.stopPropagation()}>
        <div className="pdf-reader-bar">
          <p className="pdf-reader-title">{doc.title}</p>
          <div className="pdf-reader-actions">
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Öppna i ny flik</a>
            <a href={doc.url} download className="btn btn-secondary btn-sm">Ladda ner</a>
            <button type="button" className="pdf-reader-close" onClick={onClose} aria-label="Stäng">×</button>
          </div>
        </div>
        <iframe className="pdf-reader-frame" src={doc.url} title={doc.title} />
      </div>
    </div>
  )
}
