import { useEffect, useRef, useState } from 'react'
import { useSetEditorDirty } from './editorDirty'

export interface AutosaveDraft<T> {
  value: T
  savedAt: string
}

const PREFIX = 'ncc-rs:autosave:'

/** Läser ett autosparat utkast, om det finns. */
export function loadDraft<T>(key: string): AutosaveDraft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as AutosaveDraft<T>) : null
  } catch {
    return null
  }
}

/** Tar bort ett autosparat utkast — efter återställning, avslag, eller en lyckad sparning på servern. */
export function clearDraft(key: string) {
  try { localStorage.removeItem(PREFIX + key) } catch { /* blockerad lagring m.m. */ }
}

/**
 * Autosparar `value` till localStorage med debounce, så ett påbörjat men
 * osparat utkast överlever en krasch, en stängd flik eller en omstart av
 * datorn — över webbläsarsessioner, till skillnad från sessionStorage (jfr
 * rogleHandoff.ts, som medvetet vill glömmas efter ett besök).
 *
 * `dirty` är sant från första ändringen tills debouncen hinner skriva, och
 * speglas globalt via useSetEditorDirty() så AdminLayout kan varna innan
 * utloggning om det senaste inte hunnit sparas ännu — lokalt eller på
 * servern. Sätt `skip` medan sidans egna data fortfarande laddas in, så att
 * den inledande hydreringen aldrig räknas som en användarändring.
 */
export function useAutosave<T>(key: string, value: T, opts?: { delay?: number; skip?: boolean }): { dirty: boolean; savedAt: string | null } {
  const delay = opts?.delay ?? 1200
  const skip = opts?.skip ?? false
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const setGlobalDirty = useSetEditorDirty()
  const hydrated = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Den senast schemalagda skrivningen, om debouncen inte hunnit köra än —
  // flushas vid unmount så att en snabb navigering bort (inte bara en
  // utloggning) heller inte tappar de sista tangenttrycken.
  const pendingWrite = useRef<(() => void) | null>(null)
  const serialized = JSON.stringify(value)

  useEffect(() => {
    if (skip) return
    // Första körningen sedan `skip` släppte är fortfarande bara hydrering av
    // inläst data, inte något användaren skrivit — den ska inte trigga en
    // autosparning eller markera sidan som osparad.
    if (!hydrated.current) { hydrated.current = true; return }

    setDirty(true)
    setGlobalDirty(true)
    if (timer.current) clearTimeout(timer.current)
    const write = () => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ value: JSON.parse(serialized), savedAt: new Date().toISOString() }))
      } catch { /* full/blockerad lagring — utkastet tappas, resten funkar ändå */ }
    }
    pendingWrite.current = write
    timer.current = setTimeout(() => {
      write()
      pendingWrite.current = null
      setDirty(false)
      setGlobalDirty(false)
      setSavedAt(new Date().toISOString())
    }, delay)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, skip])

  // Bara vid unmount (tom deps), inte vid varje omkörning ovan: flushar en
  // väntande skrivning direkt och nollar det globala dirty-läget, så att
  // varken utkastet eller nästa sidas utloggningskontroll blir lidande av
  // att man lämnade den här sidan mitt i debouncen.
  useEffect(() => () => {
    if (pendingWrite.current) pendingWrite.current()
    setGlobalDirty(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { dirty, savedAt }
}

/** Ett autosparat utkast som väntar på att läsas in igen, om det finns ett. */
export function useDraftRestore<T>(key: string) {
  const [draft, setDraft] = useState<AutosaveDraft<T> | null>(() => loadDraft<T>(key))

  function discard() {
    clearDraft(key)
    setDraft(null)
  }

  return { draft, discard }
}
