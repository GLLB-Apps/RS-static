import type { ReactNode } from 'react'
import { useFocusMode } from '../../lib/focusMode'

/**
 * Tvåkolumnslayouten (innehåll + höger sidopanel) för de rika redigerarna.
 * I fokusläge krymper sidopanelens spår till 0 så .editor-main tar hela
 * bredden — se EditorSidebar.tsx för själva panelens ut/in-animering.
 */
export default function EditorLayout({ children }: { children: ReactNode }) {
  const { focusMode } = useFocusMode()
  return (
    <div
      className="editor-layout"
      style={{ gridTemplateColumns: focusMode ? 'minmax(0, 1fr) 0px' : 'minmax(0, 1fr) 320px' }}
    >
      {children}
    </div>
  )
}
