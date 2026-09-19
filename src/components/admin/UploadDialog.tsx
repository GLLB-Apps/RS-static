import { useEffect } from 'react'
import Dropzone from './Dropzone'
import { useToast } from '../../lib/toast'

// Liten ruta som lägger en uppladdning ovanpå det man håller på med — t.ex. när
// en knapp i editorn ska peka på ett dokument som inte finns på sajten ännu.
// Filen laddas upp till mediabiblioteket och adressen skickas tillbaka; något
// dokumentkort skapas inte (det gör man under Dokument när filen ska listas).

export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.zip,application/pdf,image/*'

interface Props {
  onUploaded: (url: string, file: File) => void
  onClose: () => void
  title?: string
  accept?: string
  label?: string
  hint?: string
  note?: string
}

export default function UploadDialog({
  onUploaded, onClose,
  title = 'Ladda upp fil',
  accept = DOCUMENT_ACCEPT,
  label = 'Dra och släpp filen här',
  hint = 'PDF, Word, Excel, bild m.fl. – eller klicka för att välja',
  note = 'Filen laddas upp och länkas direkt från knappen. Ska den även synas i dokumentarkivet lägger du upp den under Dokument.',
}: Props) {
  const { show } = useToast()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Stäng</button>
        </div>
        <Dropzone
          accept={accept}
          label={label}
          hint={hint}
          onUploaded={(url, file) => onUploaded(url, file)}
          onComplete={onClose}
          onError={msg => show('Uppladdning misslyckades: ' + msg, 'error')}
        />
        <p className="form-hint">{note}</p>
      </div>
    </div>
  )
}
