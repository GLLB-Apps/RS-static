import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface FocusModeApi {
  focusMode: boolean
  toggle: () => void
}

const FocusModeContext = createContext<FocusModeApi | null>(null)

/**
 * Fokusläge för redigerarna: döljer adminpanelens eget ramverk (sidomeny,
 * toppbar) så bara redigerarens egen rubrikrad och innehållet blir kvar —
 * se .is-focus-mode i admin.css. AdminLayout läser `focusMode` för att
 * dölja sin egen chrome; varje redigerare togglar det via en knapp i sin
 * egen .admin-page-header (FocusModeToggle.tsx).
 */
export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusMode, setFocusMode] = useState(false)
  const toggle = () => setFocusMode(v => !v)
  return <FocusModeContext.Provider value={{ focusMode, toggle }}>{children}</FocusModeContext.Provider>
}

export function useFocusMode(): FocusModeApi {
  const ctx = useContext(FocusModeContext)
  if (!ctx) throw new Error('useFocusMode måste användas inuti FocusModeProvider')
  return ctx
}
