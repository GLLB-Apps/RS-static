import { useEffect } from 'react'
import type { ContentBlock } from './types'

export interface PreviewPayload {
  seed: string
  title: string
  intro?: string
  blocks: ContentBlock[]
}

export const PREVIEW_KEY = 'ncc-rs:preview'

/**
 * Förhandsgranskning av en redigerares OSPARADE innehåll — helt klientsidan,
 * ingen serverskrivning. En ny slumpad seed per klick skrivs till
 * localStorage (delas mellan flikar, till skillnad från sessionStorage) och
 * öppnas i en ny flik som /visa/:seed (PreviewPage.tsx). Bara EN
 * förhandsgranskning är aktiv åt gången: nästa klick skriver över den förra,
 * så en gammal länk (annan seed) matchar inte längre och visas som stängd —
 * även utan att man explicit stängt den.
 *
 * Returnerar seeden så att redigeraren kan hålla den öppna flikens innehåll
 * uppdaterat live via usePreviewSync — se den nedan.
 */
export function openPreview(payload: Omit<PreviewPayload, 'seed'>): string {
  const seed = crypto.randomUUID()
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify({ seed, ...payload }))
  } catch { /* privat läge, blockerad lagring m.m. — förhandsgranskningen öppnas ändå, bara tom */ }
  window.open(`/visa/${seed}`, '_blank', 'noopener')
  return seed
}

/** Läser den aktiva förhandsgranskningen — bara om seeden i URL:en matchar. */
export function readActivePreview(seed: string): PreviewPayload | null {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PreviewPayload
    if (data.seed !== seed) return null
    return data
  } catch {
    return null
  }
}

/** Stänger förhandsgranskningen för gott — länken slutar fungera direkt. */
export function closePreview() {
  try { localStorage.removeItem(PREVIEW_KEY) } catch { /* ignore */ }
}

/**
 * Håller en öppen förhandsgranskningsflik uppdaterad medan man skriver —
 * utan att den fliken behöver laddas om. Skriver bara till samma seed som
 * redan är aktiv (annars har en nyare förhandsgranskning tagit över, eller
 * den har stängts) — localStorage-skrivningen i den här fliken utlöser ett
 * "storage"-event i förhandsgranskningsfliken (aldrig i den egna fliken),
 * som PreviewPage.tsx lyssnar på för att rita om sig.
 */
export function usePreviewSync(seed: string | null, title: string, intro: string | undefined, blocks: ContentBlock[]) {
  useEffect(() => {
    if (!seed) return
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(PREVIEW_KEY)
        if (!raw) return
        const current = JSON.parse(raw) as PreviewPayload
        if (current.seed !== seed) return
        localStorage.setItem(PREVIEW_KEY, JSON.stringify({ seed, title, intro, blocks }))
      } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [seed, title, intro, blocks])
}
