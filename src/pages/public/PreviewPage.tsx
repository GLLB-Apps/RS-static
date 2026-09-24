import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Eye, X } from 'lucide-react'
import { readActivePreview, closePreview, PREVIEW_KEY, type PreviewPayload } from '../../lib/preview'
import { ContentBlocks } from '../../components/public/blocks'

/**
 * /visa/:seed — fokuserad förhandsgranskning utan sajtens meny/sidfot, öppnad
 * av PreviewButton.tsx i en ny flik. Innehållet kommer aldrig från servern
 * (se preview.ts): matchar seeden inte det som ligger i localStorage just nu
 * — eller om man klickat "Stäng" — visas samma "inte längre tillgänglig"-vy.
 *
 * Uppdateras live medan man skriver i redigerarfliken: den skriver till
 * samma localStorage-nyckel (usePreviewSync), vilket utlöser ett
 * "storage"-event här (bara i ANDRA flikar än den som skrev) — ingen
 * omladdning behövs.
 */
export default function PreviewPage() {
  const { seed } = useParams<{ seed: string }>()
  const [payload, setPayload] = useState<PreviewPayload | null>(() => (seed ? readActivePreview(seed) : null))
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== PREVIEW_KEY) return
      if (!e.newValue) { setPayload(null); return }
      try {
        const data = JSON.parse(e.newValue) as PreviewPayload
        if (data.seed !== seed) { setPayload(null); return }
        setPayload(data)
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [seed])

  function handleClose() {
    closePreview()
    setClosed(true)
  }

  if (!payload || closed) {
    return (
      <div className="preview-page">
        <div className="preview-page-bar">
          <span className="badge badge-muted"><Eye size={13} aria-hidden="true" /> Förhandsgranskning</span>
        </div>
        <div className="container container-narrow preview-page-body">
          <div className="empty-state">
            <p>Den här förhandsgranskningen är inte längre tillgänglig.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="preview-page">
      <div className="preview-page-bar">
        <span className="badge badge-muted"><Eye size={13} aria-hidden="true" /> Förhandsgranskning</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleClose}>
          <X size={15} aria-hidden="true" /> Stäng
        </button>
      </div>
      <div className="container container-narrow preview-page-body fade-in">
        <h1>{payload.title.trim() || 'Namnlös'}</h1>
        {payload.intro && <p className="preview-page-intro">{payload.intro}</p>}
        <ContentBlocks blocks={payload.blocks} />
      </div>
    </div>
  )
}
