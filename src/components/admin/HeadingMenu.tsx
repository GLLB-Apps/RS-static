import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HEADING_LEVELS } from '../../lib/utils'

// Rubrikväljaren i editorns verktygsrad: samma sex nivåer som markdownens
// # … ######, med #-formen och kortkommandot på varje rad.
//
// Listan ritas i en portal och positioneras mot knappen. Editorn har
// `overflow: hidden` (för de rundade hörnen), och en vanlig absolut placerad
// meny klipptes därför vid editorns kant — i en kort editor syntes bara de
// första nivåerna.

const MENU_WIDTH = 380
const GAP = 6

interface Props {
  /** Nivån på den markerade rubriken, null när något annat är markerat. */
  level: number | null
  onPick: (level: number) => void
}

export default function HeadingMenu({ level, onPick }: Props) {
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
    // true: även när editorn eller sidan scrollar under menyn
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

  function pick(l: number) {
    setOpen(false)
    onPick(l)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-tooltip="Rubrik (Ctrl+Alt+R) – klicka för att välja nivå"
        className={level ? 'tap-tool active' : 'tap-tool'}
        aria-haspopup="menu"
        aria-expanded={open}
        // Behåll markören i texten man skriver i, annars vet vi inte vilken rad som ska bli rubrik.
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(v => !v)}
      >
        Rubrik{level ? ` ${level}` : ''} <span className="tap-tool-caret" aria-hidden="true">▾</span>
      </button>

      {open && createPortal(
        <div ref={menuRef} className="tap-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          <p className="tap-menu-note">Samma nivåer som i MD-läget. Sidans titel är nivå 1, så innehållet börjar normalt på 2.</p>
          {HEADING_LEVELS.map(l => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={level === l}
              className={level === l ? 'tap-menu-item active' : 'tap-menu-item'}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(l)}
            >
              <span className="tap-menu-md">{'#'.repeat(l)}</span>
              <span className={`tap-menu-sample tap-h${l}`}>Rubrik {l}</span>
              <span className="tap-menu-key">Ctrl+Shift+{l}</span>
            </button>
          ))}
          <p className="tap-menu-note">Skriver du <code>##</code> och ett mellanslag först på raden blir den också en rubrik.</p>
        </div>,
        document.body,
      )}
    </>
  )
}
