import { Eye } from 'lucide-react'
import { openPreview, type PreviewPayload } from '../../lib/preview'

/**
 * Ögat bredvid fokuslägesknappen — öppnar en ny flik med innehållet så som
 * det hade sett ut publicerat, med de nuvarande (osparade) blocken. Tar en
 * funktion (inte ett värde) så att det alltid är det senaste utkastet i
 * redigeraren som skickas, oavsett när man klickar. `onOpen` ger redigeraren
 * seeden så den kan hålla fliken uppdaterad live via usePreviewSync.
 */
export default function PreviewButton({ getPayload, onOpen }: {
  getPayload: () => Omit<PreviewPayload, 'seed'>
  onOpen?: (seed: string) => void
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => onOpen?.(openPreview(getPayload()))}
      aria-label="Förhandsgranska"
      title="Förhandsgranska"
    >
      <Eye size={15} aria-hidden="true" />
    </button>
  )
}
