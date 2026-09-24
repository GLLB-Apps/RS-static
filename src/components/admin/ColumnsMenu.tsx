import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Kolumnblockets väljare i editorns verktygsrad: samma portal-meny-mönster
// som HeadingMenu.tsx. Tre standardbredder (50/50, 70/30, 30/70) i tre
// varianter (tomma rutor, text+bild, bild+text) — bredden går att dra om och
// rutorna fylls om i efterhand, det här är bara en startpunkt.

const MENU_WIDTH = 300
const GAP = 6

export type ColumnsPreset = 'empty' | 'text-image' | 'image-text'
export interface ColumnsChoice { ratio: [number, number]; preset: ColumnsPreset }

const RATIOS: [number, number][] = [[50, 50], [70, 30], [30, 70]]
const PRESET_GROUPS: { key: ColumnsPreset; label: string }[] = [
  { key: 'empty', label: 'Tomma rutor' },
  { key: 'text-image', label: 'Text + bild' },
  { key: 'image-text', label: 'Bild + text' },
]

export default function ColumnsMenu({ onPick }: { onPick: (choice: ColumnsChoice) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      setPos({
        top: r.bottom + GAP,
        left: Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8)),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(choice: ColumnsChoice) {
    setOpen(false)
    onPick(choice)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Kolumner – lägg innehåll sida vid sida"
        className="tap-tool tap-tool-insert"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(v => !v)}
      >
        + Kolumner <span className="tap-tool-caret" aria-hidden="true">▾</span>
      </button>

      {open && createPortal(
        <div ref={menuRef} className="tap-menu" role="menu" style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}>
          <p className="tap-menu-note">
            Lägger innehåll sida vid sida. Bredden går att dra om i efterhand, och rutorna fylls med egna block.
          </p>
          {PRESET_GROUPS.map((group, gi) => (
            <div key={group.key}>
              <p className={gi === 0 ? 'tap-menu-group-label' : 'tap-menu-group-label tap-menu-group-label-sep'}>{group.label}</p>
              <div className="tap-columns-menu-row">
                {RATIOS.map(ratio => (
                  <button
                    key={ratio.join('/')}
                    type="button"
                    role="menuitem"
                    className="tap-columns-menu-ratio"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => pick({ ratio, preset: group.key })}
                    title={`${ratio[0]}% / ${ratio[1]}%`}
                  >
                    <span className="tap-columns-menu-bar" style={{ flexGrow: ratio[0] }} />
                    <span className="tap-columns-menu-bar tap-columns-menu-bar-alt" style={{ flexGrow: ratio[1] }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
