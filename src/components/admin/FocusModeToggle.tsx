import { motion, AnimatePresence } from 'motion/react'
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
      data-tooltip={focusMode ? 'Lämna fokusläge' : 'Fokusläge'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {focusMode ? (
          <motion.span
            key="minimize"
            style={{ display: 'inline-flex' }}
            initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
            transition={{ duration: 0.15 }}
          >
            <Minimize2 size={15} aria-hidden="true" />
          </motion.span>
        ) : (
          <motion.span
            key="maximize"
            style={{ display: 'inline-flex' }}
            initial={{ opacity: 0, scale: 0.6, rotate: 45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: -45 }}
            transition={{ duration: 0.15 }}
          >
            <Maximize2 size={15} aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
