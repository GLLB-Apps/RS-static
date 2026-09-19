// Egen ikonsamling. Den kurerade uppsättningen i lib/lucide är medvetet liten,
// men hela Lucide går att rendera. Ikoner som hämtas in därifrån sparas här —
// i kollektionen `custom_icons` — och dyker sedan upp överst i ikonväljaren,
// i stället för att behöva letas upp på nytt varje gång.
//
// Bara namnet lagras (kebab-case, t.ex. "anchor"); själva ritningen kommer som
// vanligt från lucide-react, så en sparad ikon kostar inget extra i bygget.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { CustomIcon } from './types'

// Modulcache: väljaren öppnas ofta och samlingen ändras sällan.
let cache: CustomIcon[] | null = null
let inflight: Promise<CustomIcon[]> | null = null

export async function loadCustomIcons(force = false): Promise<CustomIcon[]> {
  if (force) { cache = null; inflight = null }
  if (cache) return cache
  if (inflight) return inflight
  inflight = Promise.resolve(
    supabase.from('custom_icons').select('*').order('created_at', { ascending: false }).limit(300),
  ).then(({ data }) => {
    // Saknas kollektionen ännu (skriptet inte kört) blir listan bara tom.
    const rows = (data as CustomIcon[]) ?? []
    cache = rows
    inflight = null
    return rows
  })
  return inflight
}

/** Lägger till en ikon i samlingen. Returnerar ett felmeddelande, eller null. */
export async function saveCustomIcon(name: string, label: string | null, addedBy: string | null): Promise<string | null> {
  const { error } = await supabase.from('custom_icons').insert({ name, label, added_by: addedBy })
  if (error) {
    // Unikt index på namnet — samma ikon två gånger är inget att larma om.
    if (/unique|duplicate|already exists/i.test(error.message)) return null
    return error.message
  }
  cache = null
  return null
}

export async function deleteCustomIcon(id: string): Promise<string | null> {
  const { error } = await supabase.from('custom_icons').delete().eq('id', id)
  if (error) return error.message
  cache = null
  return null
}

export function useCustomIcons() {
  const [icons, setIcons] = useState<CustomIcon[]>(cache ?? [])
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    let alive = true
    loadCustomIcons().then(rows => { if (alive) { setIcons(rows); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const refresh = useCallback(async () => {
    const rows = await loadCustomIcons(true)
    setIcons(rows)
  }, [])

  return { icons, loading, refresh }
}
