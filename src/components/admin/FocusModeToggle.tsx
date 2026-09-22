import { Maximize2, Minimize2 } from 'lucide-react'
import { useFocusMode } from '../../lib/focusMode'

/** Döljer adminpanelens sidomeny och toppbar så redigeraren får hela ytan. */
export default function FocusModeToggle() {
  const { focusMode, toggle } = useFocusMode()
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm focus-mode-toggle ${focusMode ? 'is-active' : ''}`.trim()}
      onClick={toggle}
      aria-label={focusMode ? 'Lämna fokusläge' : 'Fokusläge'}
      title={focusMode ? 'Lämna fokusläge' : 'Fokusläge'}
    >
      {focusMode ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
    </button>
  )
}
