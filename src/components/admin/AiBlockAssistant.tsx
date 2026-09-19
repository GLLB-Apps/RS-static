import { useState } from 'react'
import { X } from 'lucide-react'
import { thinking } from 'blobatar/expression'
import type { ContentBlock } from '../../lib/types'
import { apiFetch } from '../../api/client'
import { useToast } from '../../lib/toast'
import UserAvatar from '../UserAvatar'

// Skrivhjälpen i blockeditorns sidofält — beskriv vad du vill ha, så byggs
// block åt dig (rubriker, stycken, citat, punktlistor, faktarutor) som läggs
// sist i innehållet. Samma figur oavsett sida (förankad, inte per-artikel),
// med `thinking`-posen medan servern jobbar — precis den "waiting"-känslan
// biblioteket är byggt för.
export default function AiBlockAssistant({ title, onInsert }: {
  /** Sidans/artikelns rubrik, om den finns — ger AI:n lite mer sammanhang. */
  title?: string
  onInsert: (blocks: ContentBlock[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const { show } = useToast()

  async function generate() {
    if (!instruction.trim()) { show('Skriv vad du vill ha hjälp med', 'error'); return }
    setBusy(true)
    try {
      const data = await apiFetch<{ blocks: ContentBlock[] }>('/assist/blocks', {
        method: 'POST',
        body: { instruction: instruction.trim(), title: title ?? '' },
        timeoutMs: 60000,
      })
      onInsert(data.blocks)
      show(`${data.blocks.length} block tillagda längst ned`, 'success')
      setInstruction('')
      setOpen(false)
    } catch (e) {
      show('Kunde inte bygga block: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-assistant">
      <button
        type="button"
        className="ai-assistant-trigger"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <UserAvatar
          seed="rogleskogen-skrivhjalp"
          size={104}
          gaze={!busy}
          expression={busy ? thinking : undefined}
          title="Behöver du hjälp att bygga sidan?"
        />
        <span className="ai-assistant-label">
          {busy ? 'Bygger block…' : 'Behöver du hjälp att bygga sidan?'}
        </span>
      </button>

      {open && (
        <div className="ai-assistant-panel">
          <div className="ai-assistant-panel-head">
            <h3>Vad vill du ha hjälp med?</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Stäng">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder='T.ex. "Skriv en kort inledning om varför bullernivåer oroar de boende, och en punktlista med tre exempel."'
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <p className="form-hint">
            Bygger block längst ned i editorn utifrån det du skriver — läs igenom och redigera innan du publicerar.
          </p>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? 'Bygger…' : 'Bygg block'}
          </button>
        </div>
      )}
    </div>
  )
}
