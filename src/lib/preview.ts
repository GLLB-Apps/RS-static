import type { ContentBlock } from './types'

export interface PreviewPayload {
  seed: string
  title: string
  intro?: string
  blocks: ContentBlock[]
}

const PREVIEW_KEY = 'ncc-rs:preview'

/**
 * Förhandsgranskning av en redigerares OSPARADE innehåll — helt klientsidan,
 * ingen serverskrivning. En ny slumpad seed per klick skrivs till
 * localStorage (delas mellan flikar, till skillnad från sessionStorage) och
 * öppnas i en ny flik som /visa/:seed (PreviewPage.tsx). Bara EN
 * förhandsgranskning är aktiv åt gången: nästa klick skriver över den förra,
 * så en gammal länk (annan seed) matchar inte längre och visas som stängd —
 * även utan att man explicit stängt den.
 */
export function openPreview(payload: Omit<PreviewPayload, 'seed'>) {
  const seed = crypto.randomUUID()
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify({ seed, ...payload }))
  } catch { /* privat läge, blockerad lagring m.m. — förhandsgranskningen öppnas ändå, bara tom */ }
  window.open(`/visa/${seed}`, '_blank', 'noopener')
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
