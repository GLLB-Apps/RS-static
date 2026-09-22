import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useFocusMode } from '../../lib/focusMode'

/**
 * Höger sidopanel i de rika redigerarna (publicering, detaljer, statistik).
 * Döljs alltid i fokusläge — se FocusModeToggle.tsx. Publicera/Spara flyttas
 * då upp i sidhuvudet (varje redigerare gör det själv) så de förblir nåbara.
 */
export default function EditorSidebar({ children }: { children: ReactNode }) {
  const { focusMode } = useFocusMode()
  return (
    <AnimatePresence>
      {!focusMode && (
        <motion.aside
          className="editor-sidebar"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
