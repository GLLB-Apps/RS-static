import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Eye, X } from 'lucide-react'
import { readActivePreview, closePreview, type PreviewPayload } from '../../lib/preview'
import { ContentBlocks } from '../../components/public/blocks'

/**
 * /visa/:seed — fokuserad förhandsgranskning utan sajtens meny/sidfot, öppnad
 * av PreviewButton.tsx i en ny flik. Innehållet kommer aldrig från servern
 * (se preview.ts): matchar seeden inte det som ligger i localStorage just nu
 * — eller om man klickat "Stäng" — visas samma "inte längre tillgänglig"-vy.
 */
export default function PreviewPage() {
  const { seed } = useParams<{ seed: string }>()
  const [payload] = useState<PreviewPayload | null>(() => (seed ? readActivePreview(seed) : null))
  const [closed, setClosed] = useState(false)

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
