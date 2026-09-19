// Notiser för intranätet: nytt sedan användaren senast tittade, per sektion.
// Helt skild från adminpanelens notiser (notifications.tsx) och rör BARA
// intranätsinnehåll. Läsläget lagras i samma profiles.notifications_seen-JSON,
// men med egna nycklar (notices/notes/tasks/documents) så de två systemen inte
// skriver över varandra — varje provider spridar hela kartan vid skrivning.
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { INTRANET_SOURCES, INTRANET_KEYS as SOURCE_KEYS, type IntranetSource } from './intranetSources'

export { INTRANET_SOURCES, type IntranetSource } from './intranetSources'

export interface IntranetNotificationItem {
  id: string
  source: IntranetSource
  title: string
  at: string
  path: string
  isNew: boolean
}

type SeenMap = Record<string, string>

interface Value {
  items: IntranetNotificationItem[]
  newCount: number
  newBySource: Record<IntranetSource, number>
  loading: boolean
  markAllRead: () => Promise<void>
  markSourceRead: (source: IntranetSource) => Promise<void>
}

const Ctx = createContext<Value | null>(null)
const RECENT_LIMIT = 20

export function IntranetNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [items, setItems] = useState<IntranetNotificationItem[]>([])
  const [seenMap, setSeenMap] = useState<SeenMap>({})
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) { setItems([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)

    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      ...SOURCE_KEYS.map(key => {
        const s = INTRANET_SOURCES[key]
        return supabase.from(s.table).select('*').order(s.tsField, { ascending: false }).limit(RECENT_LIMIT)
      }),
    ]).then(([profile, ...results]) => {
      if (cancelled) return
      const seen = (profile.data?.notifications_seen as SeenMap | undefined) ?? {}
      setSeenMap(seen)

      const list: IntranetNotificationItem[] = []
      results.forEach((res, i) => {
        const key = SOURCE_KEYS[i]
        const s = INTRANET_SOURCES[key]
        for (const row of (res.data ?? []) as Record<string, string>[]) {
          const at = row[s.tsField]
          const mark = seen[key]
          list.push({
            id: row.id,
            source: key,
            title: (row[s.titleField] || '').trim() || '(utan titel)',
            at,
            path: s.path,
            isNew: !mark || new Date(at).getTime() > new Date(mark).getTime(),
          })
        }
      })
      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      setItems(list)
      setLoading(false)
    }).catch((e: unknown) => {
      if (cancelled) return
      console.error('Kunde inte hämta intranätsnotiser', e)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [userId, tick])

  // Sprider hela seen-kartan så adminpanelens nycklar bevaras.
  const persistSeen = useCallback(async (next: SeenMap, sources: IntranetSource[]) => {
    if (!user) return
    const res = await supabase.from('profiles').upsert({ id: user.id, notifications_seen: next })
    if (res.error) return
    setSeenMap(next)
    setItems(prev => prev.map(i => (sources.includes(i.source) ? { ...i, isNew: false } : i)))
  }, [user])

  const markSourceRead = useCallback(async (source: IntranetSource) => {
    await persistSeen({ ...seenMap, [source]: new Date().toISOString() }, [source])
  }, [persistSeen, seenMap])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    await persistSeen({ ...seenMap, ...Object.fromEntries(SOURCE_KEYS.map(s => [s, now])) }, SOURCE_KEYS)
  }, [persistSeen, seenMap])

  const newBySource = { notices: 0, notes: 0, tasks: 0, documents: 0 } as Record<IntranetSource, number>
  for (const i of items) if (i.isNew) newBySource[i.source]++
  const newCount = SOURCE_KEYS.reduce((n, k) => n + newBySource[k], 0)

  const refresh = useCallback(() => setTick(t => t + 1), [])
  void refresh

  return (
    <Ctx.Provider value={{ items, newCount, newBySource, loading, markAllRead, markSourceRead }}>
      {children}
    </Ctx.Provider>
  )
}

export function useIntranetNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useIntranetNotifications must be used within IntranetNotificationsProvider')
  return ctx
}

/** Markerar en sektion som läst när sidan varit synlig en stund (inte vid klicket). */
export function useMarkIntranetRead(source: IntranetSource, ready = true, delayMs = 2000) {
  const { markSourceRead, newBySource } = useIntranetNotifications()
  const pending = newBySource[source]
  useEffect(() => {
    if (!ready || pending === 0) return
    const timer = setTimeout(() => { void markSourceRead(source) }, delayMs)
    return () => clearTimeout(timer)
  }, [ready, pending, source, delayMs, markSourceRead])
}
