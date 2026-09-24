import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ContentBlock, LayoutColumn } from '../../lib/types'
import TapEditor from './TapEditor'

// Kolumnblockets innehåll: två spalter sida vid sida, var och en en egen
// nästlad TapEditor (samma editor som resten av dokumentet, så rutorna
// fylls och redigeras precis som allt annat, men utan egen verktygsrad —
// se TapActiveContext i TapEditor.tsx). Mittlinjen är en riktig dragbar
// splitter — pointer capture håller draget stabilt även om musen lämnar
// knappen mitt i rörelsen. Breddprocenten syns bara vid hovring/drag av
// splittern, inte som en permanent etikett.

const MIN_WIDTH = 15
const MAX_WIDTH = 85

export default function ColumnsBlockEditor({ columns, onChange }: {
  columns: LayoutColumn[]
  onChange: (columns: LayoutColumn[]) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const cols: LayoutColumn[] = columns.length === 2 ? columns : [{ width: 50, blocks: [] }, { width: 50, blocks: [] }]

  function setColumnBlocks(index: number, blocks: ContentBlock[]) {
    onChange(cols.map((c, i) => (i === index ? { ...c, blocks } : c)))
  }

  function startDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    const row = rowRef.current
    if (!row) return
    const rect = row.getBoundingClientRect()
    setDragging(true)
    function onMove(ev: PointerEvent) {
      const x = ev.clientX - rect.left
      const pct = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round((x / rect.width) * 100)))
      onChange([{ ...cols[0], width: pct }, { ...cols[1], width: 100 - pct }])
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="tap-columns" ref={rowRef} style={{ gridTemplateColumns: `${cols[0].width}fr 14px ${cols[1].width}fr` }}>
      <div className="tap-column">
        <TapEditor blocks={cols[0].blocks} onChange={blocks => setColumnBlocks(0, blocks)} nested />
      </div>
      <button
        type="button"
        className={dragging ? 'tap-column-splitter is-dragging' : 'tap-column-splitter'}
        onPointerDown={startDrag}
        aria-label="Dra för att ändra bredd mellan kolumnerna"
        title="Dra för att ändra bredd"
      >
        <span className="tap-column-splitter-value">{Math.round(cols[0].width)}% / {Math.round(cols[1].width)}%</span>
      </button>
      <div className="tap-column">
        <TapEditor blocks={cols[1].blocks} onChange={blocks => setColumnBlocks(1, blocks)} nested />
      </div>
    </div>
  )
}
