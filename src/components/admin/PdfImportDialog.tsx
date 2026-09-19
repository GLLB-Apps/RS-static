import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentBlock } from '../../lib/types'
import { pdfToMarkdown } from '../../lib/pdfToMarkdown'
import { markdownToBlocks } from '../../lib/markdownBlocks'
import { ContentBlocks } from '../public/blocks'

// Hämtar texten ur en PDF och lämnar tillbaka den som markdown, redo att läggas
// in i MD-läget. Allt sker i webbläsaren med pdf.js: filen laddas aldrig upp
// någonstans, och inget serverpaket behöver installeras.
//
// Läsningen sker i tre steg — välj fil, läs (med progressbar), granska. Steget
// däremellan finns för att en PDF-tolkning aldrig blir perfekt: här ser man vad
// den blev, både som block och som markdown, innan något hamnar i editorn.

// Namn i plural för sammanfattningen ("12 rubriker").
const PLURAL: Partial<Record<ContentBlock['type'], string>> = {
  heading: 'rubriker', paragraph: 'stycken', quote: 'citat',
  image: 'bilder', factbox: 'faktarutor', warning: 'varningsrutor',
  list: 'punktlistor', cta: 'uppmaningar', video: 'videor', button: 'knappar',
  links: 'länklistor', table: 'tabeller', comparison: 'jämförelser',
  sources: 'källförteckningar', divider: 'avdelare',
}

interface Result {
  markdown: string
  blocks: ContentBlock[]
  fileName: string
}

interface Props {
  onImported: (markdown: string, fileName: string) => void
  onClose: () => void
}

export default function PdfImportDialog({ onImported, onClose }: Props) {
  const [progress, setProgress] = useState<{ page: number; pages: number } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [tab, setTab] = useState<'blocks' | 'markdown'>('blocks')
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Läsningen fortsätter annars i bakgrunden om rutan stängs mitt i.
  useEffect(() => () => { cancelledRef.current = true }, [])

  const summary = useMemo(() => {
    if (!result) return ''
    const counts = new Map<ContentBlock['type'], number>()
    for (const block of result.blocks) counts.set(block.type, (counts.get(block.type) ?? 0) + 1)
    const parts = [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${count} ${PLURAL[type] ?? type}`)
    return `${result.blocks.length} block — ${parts.join(', ')}`
  }, [result])

  async function read(file: File | undefined) {
    if (!file || progress) return
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Välj en PDF-fil.')
      return
    }
    setError(null)
    setResult(null)
    cancelledRef.current = false
    setProgress({ page: 0, pages: 0 })

    try {
      const markdown = await pdfToMarkdown(file, {
        onProgress: setProgress,
        isCancelled: () => cancelledRef.current,
      })
      if (cancelledRef.current) return
      if (!markdown.trim()) {
        throw new Error('PDF:en innehåller ingen text att hämta. Är den inskannad behöver den tolkas med OCR först.')
      }
      setResult({ markdown, blocks: markdownToBlocks(markdown), fileName: file.name })
    } catch (e) {
      if (cancelledRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  const busy = progress != null
  const percent = progress && progress.pages > 0 ? Math.round((progress.page / progress.pages) * 100) : 0

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className={result ? 'admin-modal wide' : 'admin-modal'}
        role="dialog"
        aria-modal="true"
        aria-label="Hämta text från PDF"
        onClick={e => e.stopPropagation()}
      >
        <div className="admin-modal-head">
          <h3>{result ? `Granska: ${result.fileName}` : 'Hämta text från PDF'}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {busy ? 'Avbryt' : 'Stäng'}
          </button>
        </div>

        {busy && (
          <div className="pdf-import-progress">
            <div className="pdf-import-bar">
              <div className="pdf-import-bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="form-hint">
              {progress.pages > 0 ? `Läser sida ${progress.page} av ${progress.pages}…` : 'Öppnar dokumentet…'}
            </p>
          </div>
        )}

        {!busy && !result && (
          <div
            className={`dropzone${over ? ' over' : ''}`}
            onDragOver={e => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]) }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={e => { read(e.target.files?.[0]); e.target.value = '' }}
            />
            <span className="dropzone-icon" aria-hidden="true">⬆</span>
            <span className="dropzone-label">Dra och släpp PDF:en här</span>
            <span className="dropzone-hint">eller klicka för att välja</span>
          </div>
        )}

        {!busy && result && (
          <>
            <div className="pdf-review-head">
              <p className="form-hint">{summary}</p>
              <div className="tap-mode-switch" role="group" aria-label="Visa som">
                <button type="button" className={tab === 'blocks' ? 'tap-mode active' : 'tap-mode'} onClick={() => setTab('blocks')}>Block</button>
                <button type="button" className={tab === 'markdown' ? 'tap-mode active' : 'tap-mode'} onClick={() => setTab('markdown')}>Markdown</button>
              </div>
            </div>

            <div className="pdf-review-body">
              {tab === 'blocks'
                ? <ContentBlocks blocks={result.blocks} />
                : <pre className="pdf-review-markdown">{result.markdown}</pre>}
            </div>

            <div className="admin-form-actions">
              <button type="button" className="btn btn-primary" onClick={() => onImported(result.markdown, result.fileName)}>
                Lägg in i editorn
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setResult(null); setError(null) }}>
                Välj en annan fil
              </button>
            </div>
          </>
        )}

        {error && <p className="form-hint form-hint-warning">{error}</p>}

        {!result && (
          <p className="form-hint">
            Rubriker, stycken och punktlistor följer med som block. Tabeller
            kommer in som text, och bilder följer inte med alls. Filen läses här i
            webbläsaren och laddas inte upp någonstans.
          </p>
        )}
      </div>
    </div>
  )
}
