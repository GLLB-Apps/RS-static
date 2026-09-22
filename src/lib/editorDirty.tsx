import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'

interface EditorDirtyApi {
  get: () => boolean
  set: (dirty: boolean) => void
}

const EditorDirtyContext = createContext<EditorDirtyApi | null>(null)

/**
 * Delar "har den öppna redigeraren ett utkast som autosparningen inte hunnit
 * skriva än?" mellan valfri redigerarsida (som sätter det via useAutosave)
 * och AdminLayout (som bara läser det en gång, precis innan utloggning). En
 * ref i stället för state — ingen ska rendera om när det ändras under tiden
 * man skriver, bara läsa det färska värdet vid själva klicket på Logga ut.
 */
export function EditorDirtyProvider({ children }: { children: ReactNode }) {
  const dirty = useRef(false)
  const api = useRef<EditorDirtyApi>({
    get: () => dirty.current,
    set: (d: boolean) => { dirty.current = d },
  }).current
  return <EditorDirtyContext.Provider value={api}>{children}</EditorDirtyContext.Provider>
}

function useApi(): EditorDirtyApi {
  const ctx = useContext(EditorDirtyContext)
  if (!ctx) throw new Error('Måste användas inuti EditorDirtyProvider')
  return ctx
}

/** AdminLayout läser detta precis innan utloggning för att kunna varna. */
export function useIsEditorDirty(): () => boolean {
  return useApi().get
}

/** useAutosave anropar detta för att spegla sitt dirty-läge globalt. */
export function useSetEditorDirty(): (dirty: boolean) => void {
  return useApi().set
}
