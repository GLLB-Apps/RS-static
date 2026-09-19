import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'

export type BlobAvatarsMode = 'off' | 'admin' | 'everywhere'

const BlobSettingsContext = createContext<BlobAvatarsMode>('everywhere')

// Hämtar site_settings.blob_avatars en gång för hela sessionen. Osatt (äldre
// rader som sparades innan fältet fanns) tolkas som 'everywhere', så
// befintliga installationer inte tappar blobbarna av sig själva.
export function BlobAvatarsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<BlobAvatarsMode>('everywhere')

  useEffect(() => {
    supabase.from('site_settings').select('blob_avatars').maybeSingle().then(({ data }) => {
      const value = (data as { blob_avatars?: string | null } | null)?.blob_avatars
      if (value === 'off' || value === 'admin' || value === 'everywhere') setMode(value)
    })
  }, [])

  return <BlobSettingsContext.Provider value={mode}>{children}</BlobSettingsContext.Provider>
}

/**
 * Är Rögleblobbarna påslagna på den del av sajten man just nu befinner sig
 * på? 'admin' i inställningarna räknas som /admin och /internt — den
 * publika sidan och det interna arbetsrummet är annars samma slags "inloggad
 * panel" ur den här knappens perspektiv.
 */
export function useBlobAvatarsEnabled(): boolean {
  const mode = useContext(BlobSettingsContext)
  const { pathname } = useLocation()
  if (mode === 'off') return false
  if (mode === 'admin') return pathname.startsWith('/admin') || pathname.startsWith('/internt')
  return true
}
