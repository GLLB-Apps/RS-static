import { Eye } from 'lucide-react'
import { openPreview, type PreviewPayload } from '../../lib/preview'

/**
 * Ögat bredvid fokuslägesknappen — öppnar en ny flik med innehållet så som
 * det hade sett ut publicerat, med de nuvarande (osparade) blocken. Tar en
 * funktion (inte ett värde) så att det alltid är det senaste utkastet i
 * redigeraren som skickas, oavsett när man klickar.
 */
export default function PreviewButton({ getPayload }: { getPayload: () => Omit<PreviewPayload, 'seed'> }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => openPreview(getPayload())}
      aria-label="Förhandsgranska"
      title="Förhandsgranska"
    >
      <Eye size={15} aria-hidden="true" />
    </button>
  )
}
