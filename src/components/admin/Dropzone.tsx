import { useRef, useState } from 'react'
import { isHeic, uploadFile } from '../../lib/storage'
import { useToast } from '../../lib/toast'

interface Props {
  onUploaded: (url: string, file: File) => void | Promise<void>
  onComplete?: () => void
  onError?: (message: string) => void
  multiple?: boolean
  accept?: string
  label?: string
  hint?: string
  compact?: boolean
}

export default function Dropzone({ onUploaded, onComplete, onError, multiple = false, accept = 'image/*,.heic,.heif', label, hint, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleFiles(fileList: FileList | null) {
    if (busy || !fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setBusy(true)
    setProgress({ done: 0, total: files.length })
    try {
      for (let i = 0; i < files.length; i++) {
        // iPhone-bilder görs om till JPEG före uppladdning, vilket tar en stund.
        setConverting(isHeic(files[i]))
        const url = await uploadFile(files[i])
        setConverting(false)
        await onUploaded(url, files[i])
        setProgress({ done: i + 1, total: files.length })
      }
      onComplete?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (onError) onError(msg)
      else show('Uppladdning misslyckades: ' + msg, 'error')
    } finally {
      setBusy(false)
      setConverting(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}${compact ? ' compact' : ''}${busy ? ' busy' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); inputRef.current?.click() } }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} hidden onChange={e => handleFiles(e.target.files)} />
      {busy ? (
        <div className="dropzone-status">
          {converting ? 'Konverterar iPhone-bild (HEIC → JPEG)…' : 'Laddar upp…'} {progress ? `${progress.done}/${progress.total}` : ''}
        </div>
      ) : (
        <>
          <span className="dropzone-icon" aria-hidden="true">⬆</span>
          <span className="dropzone-label">{label ?? (multiple ? 'Dra och släpp bilder här' : 'Dra och släpp en bild här')}</span>
          <span className="dropzone-hint">{hint ?? 'eller klicka för att välja'}</span>
        </>
      )}
    </div>
  )
}
