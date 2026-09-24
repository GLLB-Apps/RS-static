import { useEffect, useMemo, useState } from 'react'
import type { MediaItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import Dropzone from './Dropzone'

// Väljare för bildblocket: plocka en bild ur mediabiblioteket, eller släpp in en
// ny. Adressen behöver aldrig klistras in för hand, och alt-texten följer med
// från biblioteket när den är ifylld där.
//
// En uppladdning här läggs också till i biblioteket, precis som under Media, så
// att samma bild går att återanvända på andra sidor.

export interface PickedMedia {
  url: string
  alt: string
}

interface Props {
  onPick: (media: PickedMedia) => void
  onClose: () => void
}

export default function MediaPicker({ onPick, onClose }: Props) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const { user } = useAuth()
  const { show } = useToast()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let active = true
    supabase.from('media_items').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return
        // Video har ingen fil att visa, och utan adress finns inget att välja.
        setItems((data as MediaItem[] ?? []).filter(m => m.file_url))
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(m =>
      m.title.toLowerCase().includes(needle) || (m.alt_text ?? '').toLowerCase().includes(needle))
  }, [items, query])

  /** Ny bild: upp i storagen, in i biblioteket, och vald direkt. */
  async function addUploaded(url: string, file: File) {
    const title = file.name.replace(/\.[^.]+$/, '')
    const { error } = await supabase.from('media_items').insert({
      title, media_type: 'image', file_url: url, status: 'draft',
      created_by: user?.id, updated_by: user?.id,
    })
    // Bilden är uppladdad och användbar även om biblioteksposten inte gick att
    // skapa — då är det bara återanvändningen som uteblir.
    if (error) show('Bilden lades inte till i mediabiblioteket: ' + error.message, 'warning')
    onPick({ url, alt: '' })
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal wide" role="dialog" aria-modal="true" aria-label="Välj bild" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h3>Välj bild</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Stäng</button>
        </div>

        <Dropzone
          compact
          accept="image/*,.heic,.heif"
          label="Dra och släpp en ny bild här"
          hint="eller klicka för att välja — den läggs samtidigt till i mediabiblioteket"
          onUploaded={addUploaded}
          onError={msg => show('Uppladdning misslyckades: ' + msg, 'error')}
        />

        {items.length > 0 && (
          <input
            className="form-input"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök bland bilderna…"
            style={{ marginTop: 'var(--space-3)' }}
          />
        )}

        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : visible.length === 0 ? (
          <p className="form-hint">
            {items.length === 0
              ? 'Mediabiblioteket är tomt än — släpp en bild här ovanför så hamnar den både på sidan och i biblioteket.'
              : 'Ingen bild matchar sökningen.'}
          </p>
        ) : (
          <div className="media-grid media-picker-grid">
            {visible.map(m => (
              <button
                key={m.id}
                type="button"
                className="media-card media-picker-card"
                onClick={() => onPick({ url: m.file_url ?? '', alt: m.alt_text ?? '' })}
                data-tooltip={m.title}
              >
                <div className="media-card-thumb">
                  <img src={m.file_url ?? ''} alt={m.alt_text ?? m.title} loading="lazy" />
                </div>
                <div className="media-card-body">
                  <div className="media-card-title">{m.title}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
