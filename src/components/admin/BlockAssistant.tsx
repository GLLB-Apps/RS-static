import { useState } from 'react'
import { X } from 'lucide-react'
import type { ContentBlock } from '../../lib/types'
import { markdownToBlocks } from '../../lib/markdownBlocks'
import UserAvatar from '../UserAvatar'

// Skrivhjälpen i blockeditorns sidofält. Ingen AI — bygger block direkt ur
// det du skriver med samma enkla markdown som editorns eget MD-läge förstår
// (## rubrik, - punkt, > citat, :::fakta ... :::), så du kan klistra in ett
// halvfärdigt utkast eller skriva snabbt utan att klicka fram varje block för
// hand. Allt sker lokalt i webbläsaren — inget skickas någonstans.
export default function BlockAssistant({ onInsert }: {
  onInsert: (blocks: ContentBlock[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  function build() {
    if (!text.trim()) { setError('Skriv eller klistra in text först'); return }
    const blocks = markdownToBlocks(text)
    if (blocks.length === 0) { setError('Kunde inte tolka texten till några block'); return }
    onInsert(blocks)
    setText('')
    setError('')
    setOpen(false)
  }

  return (
    <div className="block-assistant">
      <button
        type="button"
        className="block-assistant-trigger"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <UserAvatar seed="rogleskogen-skrivhjalp" size={104} gaze title="Bygg block av text" />
        <span className="block-assistant-label">Bygg block av text</span>
      </button>

      {open && (
        <div className="block-assistant-panel">
          <div className="block-assistant-panel-head">
            <h3>Skriv eller klistra in</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Stäng">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <textarea
            className="form-textarea"
            rows={6}
            placeholder={'## Rubrik\nEtt stycke text.\n\n- Punkt ett\n- Punkt två\n\n> Ett citat'}
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <p className="form-hint">
            Samma enkla skrivsätt som editorns MD-läge: <code># rubrik</code>, <code>- punkt</code>,{' '}
            <code>&gt; citat</code>, tom rad = nytt stycke. Läggs till längst ned i innehållet.
          </p>
          <button type="button" className="btn btn-primary" onClick={build}>Bygg block</button>
        </div>
      )}
    </div>
  )
}
