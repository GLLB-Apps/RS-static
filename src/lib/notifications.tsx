// Notiser för adminpanelen: allt som kommit in utifrån sedan användaren senast
// läste sina notiser. Delas av klockan i topbaren och badgarna i Översikt, så
// att båda visar samma siffror från en enda hämtning.
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { DRAFT_SOURCES, DRAFT_STATUSES } from './drafts'
import { INTRANET_SOURCES, INTRANET_KEYS, type IntranetSource } from './intranetSources'
import type { ContentStatus } from './types'

// Adminpanelens klocka täcker både publikt inflöde (meddelanden, vittnesmål,
// utkast) OCH intranätet, eftersom alla admin-roller har intranätsåtkomst.
export type NotificationSource = 'messages' | 'testimonies' | 'drafts' | IntranetSource

export interface NotificationSourceMeta {
  label: string
  path: string
}

export const NOTIFICATION_SOURCES: Record<NotificationSource, NotificationSourceMeta> = {
  messages: { label: 'Meddelande', path: '/admin/meddelanden' },
  testimonies: { label: 'Vittnesmål', path: '/admin/vittnesmal' },
  drafts: { label: 'Utkast', path: '/admin/utkast' },
  notices: { label: 'Anslag', path: INTRANET_SOURCES.notices.path },
  notes: { label: 'Anteckning', path: INTRANET_SOURCES.notes.path },
  tasks: { label: 'Uppgift', path: INTRANET_SOURCES.tasks.path },
  documents: { label: 'Dokument', path: INTRANET_SOURCES.documents.path },
}

export interface NotificationItem {
  id: string
  source: NotificationSource
  title: string
  subtitle: string
  created_at: string
  path: string
  /** Inkommet efter att användaren senast läste sina notiser. */
  isNew: boolean
}

interface NotificationsValue {
  items: NotificationItem[]
  /** Antal nya sedan senast lästa, totalt och per källa. */
  newCount: number
  newBySource: Record<NotificationSource, number>
  /** Totalt antal utkast i systemet — används av kortet i Översikt. */
  draftTotal: number
  loading: boolean
  /** Felmeddelande om notiserna inte kunde hämtas. */
  error: string | null
  /** Antal lästa poster som skulle döljas av en rensning. */
  clearableCount: number
  markAllRead: () => Promise<void>
  /** Markerar en enskild källa som läst — används när man öppnar dess meny. */
  markSourceRead: (source: NotificationSource) => Promise<void>
  /** Döljer redan lästa notiser. Olästa och nyinkomna står kvar. */
  clearRead: () => Promise<void>
  refresh: () => void
}

/** Tidsstämpel per källa för när användaren senast såg dess innehåll. */
type SeenMap = Partial<Record<NotificationSource, string>>

const NotificationsContext = createContext<NotificationsValue | null>(null)

const RECENT_LIMIT = 30

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [seenMap, setSeenMap] = useState<SeenMap>({})
  const [clearedAt, setClearedAt] = useState<string | null>(null)
  const [draftTotal, setDraftTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  // Beroendet är användarens id, inte user-objektet: AuthProvider skapar ett
  // nytt objekt varje gång sessionen läses om, och med objektet som beroende
  // avbröt varje omkörning den föregående hämtningen.
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) { setItems([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(RECENT_LIMIT),
      supabase.from('testimonies').select('*').order('created_at', { ascending: false }).limit(RECENT_LIMIT),
      ...DRAFT_SOURCES.map(s => supabase.from(s.table).select('*').order('updated_at', { ascending: false })),
      ...INTRANET_KEYS.map(k => supabase.from(INTRANET_SOURCES[k].table).select('*').order(INTRANET_SOURCES[k].tsField, { ascending: false }).limit(RECENT_LIMIT)),
    ]).then((all) => {
      if (cancelled) return
      const [profile, messages, testimonies] = all
      const draftResults = all.slice(3, 3 + DRAFT_SOURCES.length)
      const intranetResults = all.slice(3 + DRAFT_SOURCES.length)
      // Shimmen sväljer fel och returnerar tom data — lyft fram dem i stället
      // för att visa en tom lista som om ingenting hade kommit in.
      const failed = [messages.error, testimonies.error].filter(Boolean)
      if (failed.length) setError(failed.map(e => e!.message).join(' · '))

      // Shimmen parsar notifications_seen från JSON åt oss (se JSON_FIELDS).
      const seen = (profile.data?.notifications_seen as SeenMap | undefined) ?? {}
      const cleared = (profile.data?.notifications_cleared_at as string | undefined) ?? null
      const isNew = (source: NotificationSource, at: string) => {
        const mark = seen[source]
        return !mark || new Date(at).getTime() > new Date(mark).getTime()
      }
      setSeenMap(seen)
      setClearedAt(cleared)

      const list: NotificationItem[] = []
      for (const m of (messages.data ?? []) as Record<string, string>[]) {
        list.push({
          id: m.id,
          source: 'messages',
          title: m.subject?.trim() || 'Meddelande utan ämne',
          subtitle: [m.name, m.email].filter(Boolean).join(' · ') || 'Okänd avsändare',
          created_at: m.created_at,
          path: NOTIFICATION_SOURCES.messages.path,
          isNew: isNew('messages', m.created_at),
        })
      }
      for (const t of (testimonies.data ?? []) as Record<string, string>[]) {
        const author = t.is_anonymous ? 'Anonym' : (t.author_name || 'Anonym')
        list.push({
          id: t.id,
          source: 'testimonies',
          title: t.title?.trim() || 'Nytt vittnesmål',
          subtitle: [author, t.location].filter(Boolean).join(' · '),
          created_at: t.created_at,
          path: NOTIFICATION_SOURCES.testimonies.path,
          isNew: isNew('testimonies', t.created_at),
        })
      }
      // Utkast: opublicerat innehåll oavsett innehållstyp. "Nytt" här betyder
      // ändrat sedan användaren senast läste sina notiser.
      let drafts = 0
      draftResults.forEach((res, i) => {
        const source = DRAFT_SOURCES[i]
        for (const row of (res.data ?? []) as Record<string, string>[]) {
          if (!DRAFT_STATUSES.includes(row.status as ContentStatus)) continue
          drafts++
          list.push({
            id: row.id,
            source: 'drafts',
            title: (row[source.titleField] || '').trim() || '(utan titel)',
            subtitle: source.label,
            created_at: row.updated_at,
            path: NOTIFICATION_SOURCES.drafts.path,
            isNew: isNew('drafts', row.updated_at),
          })
        }
      })

      // Intranätet: alla admin-roller har åtkomst, så aktivitet där visas i
      // adminpanelens klocka också. Samma seen-nycklar som intranätets egen
      // klocka, så en läst notis är läst på båda ställena.
      intranetResults.forEach((res, i) => {
        const key = INTRANET_KEYS[i]
        const cfg = INTRANET_SOURCES[key]
        for (const row of (res.data ?? []) as Record<string, string>[]) {
          const at = row[cfg.tsField]
          list.push({
            id: row.id,
            source: key,
            title: (row[cfg.titleField] || '').trim() || '(utan titel)',
            subtitle: cfg.label,
            created_at: at,
            path: cfg.path,
            isNew: isNew(key, at),
          })
        }
      })

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setDraftTotal(drafts)
      setItems(list)
      setLoading(false)
    }).catch((e: unknown) => {
      // Utan detta fastnar panelen på "Laddar…" utan spår av vad som gick fel.
      console.error('Kunde inte hämta notiser', e)
      if (cancelled) return
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [userId, tick])

  /** Skriver hela seen-kartan till profilen och speglar den lokalt. */
  const persistSeen = useCallback(async (next: SeenMap, sources: NotificationSource[]) => {
    if (!user) return
    // Profilraden har användarens id som dokument-id (se appwrite-setup.mjs).
    const res = await supabase.from('profiles').upsert({ id: user.id, notifications_seen: next })
    if (res.error) { setError('Kunde inte spara som läst: ' + res.error.message); return }
    setSeenMap(next)
    setItems(prev => prev.map(i => (sources.includes(i.source) ? { ...i, isNew: false } : i)))
  }, [user])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    const all = Object.keys(NOTIFICATION_SOURCES) as NotificationSource[]
    // Sprid seenMap så intranätets nycklar i samma JSON inte skrivs över.
    await persistSeen({ ...seenMap, ...Object.fromEntries(all.map(s => [s, now])) } as SeenMap, all)
  }, [persistSeen, seenMap])

  const markSourceRead = useCallback(async (source: NotificationSource) => {
    const now = new Date().toISOString()
    await persistSeen({ ...seenMap, [source]: now }, [source])
  }, [persistSeen, seenMap])

  const clearRead = useCallback(async () => {
    if (!user) return
    const now = new Date().toISOString()
    const res = await supabase.from('profiles').upsert({ id: user.id, notifications_cleared_at: now })
    if (res.error) { setError('Kunde inte rensa: ' + res.error.message); return }
    setClearedAt(now)
  }, [user])

  // En rensad post är läst OCH fanns redan när rensningen gjordes. Allt som
  // kommit in efteråt, och allt oläst, står kvar i listan.
  const isCleared = (i: NotificationItem) =>
    !i.isNew && clearedAt != null && new Date(i.created_at).getTime() <= new Date(clearedAt).getTime()

  const visibleItems = items.filter(i => !isCleared(i))
  const clearableCount = visibleItems.filter(i => !i.isNew).length

  const newBySource = { messages: 0, testimonies: 0, drafts: 0, notices: 0, notes: 0, tasks: 0, documents: 0 } as Record<NotificationSource, number>
  for (const i of visibleItems) if (i.isNew) newBySource[i.source]++
  const newCount = (Object.values(newBySource) as number[]).reduce((a, b) => a + b, 0)

  return (
    <NotificationsContext.Provider value={{
      items: visibleItems, newCount, newBySource, draftTotal,
      loading, error, clearableCount, markAllRead, markSourceRead, clearRead, refresh,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}

/**
 * Markerar en notiskälla som läst när användaren faktiskt stannat kvar på dess
 * sida en stund — inte redan vid menyklicket. Klickar man fel och navigerar
 * bort hinner markeringen aldrig ske, så badgen står kvar.
 *
 * @param ready Sätt till false medan sidan laddar, så att nedräkningen startar
 *              först när innehållet syns.
 */
export function useMarkSourceRead(source: NotificationSource, ready = true, delayMs = 2000) {
  const { markSourceRead, newBySource } = useNotifications()
  const pending = newBySource[source]

  useEffect(() => {
    if (!ready || pending === 0) return
    const timer = setTimeout(() => { void markSourceRead(source) }, delayMs)
    return () => clearTimeout(timer)
  }, [ready, pending, source, delayMs, markSourceRead])
}

/** Kortare relativ tid på svenska, t.ex. "3 tim sedan". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return ''
  const min = Math.round(diff / 60000)
  if (min < 1) return 'nyss'
  if (min < 60) return `${min} min sedan`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs} tim sedan`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} d sedan`
  return new Date(iso).toLocaleDateString('sv-SE')
}
