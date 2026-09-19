// Register över allt innehåll som kan sparas som utkast. Utkastsidan läser det
// här och behöver inte känna till varje kollektion för sig — lägger man till en
// ny innehållstyp räcker det att den kommer med här.
import type { ContentStatus } from './types'

export interface DraftSource {
  table: string
  /** Visas som typ-etikett i listan, t.ex. "Nyhet". */
  label: string
  /** Fältet som används som rubrik i listan. */
  titleField: string
  /** Länk till redigeringsvyn för en post. */
  editPath: (id: string) => string
  /**
   * Kollektioner utan created_by kan inte filtreras på "Mina utkast" —
   * de visas bara under "Alla utkast".
   */
  hasAuthor: boolean
}

export const DRAFT_SOURCES: DraftSource[] = [
  { table: 'posts', label: 'Nyhet', titleField: 'title', editPath: id => `/admin/nyheter/${id}`, hasAuthor: true },
  { table: 'topics', label: 'Ämne', titleField: 'title', editPath: id => `/admin/amnen/${id}`, hasAuthor: true },
  { table: 'documents', label: 'Dokument', titleField: 'title', editPath: id => `/admin/dokument/${id}`, hasAuthor: true },
  { table: 'media_items', label: 'Media', titleField: 'title', editPath: id => `/admin/media/${id}`, hasAuthor: true },
  { table: 'timeline_events', label: 'Tidslinje', titleField: 'title', editPath: id => `/admin/tidslinje/${id}`, hasAuthor: true },
  { table: 'map_locations', label: 'Kartpunkt', titleField: 'title', editPath: id => `/admin/karta/${id}`, hasAuthor: true },
  { table: 'map_areas', label: 'Kartområde', titleField: 'title', editPath: id => `/admin/karta/omrade/${id}`, hasAuthor: true },
  { table: 'faq_items', label: 'FAQ', titleField: 'question', editPath: () => '/admin/faq', hasAuthor: false },
]

/** Opublicerade lägen. "review" räknas som utkast — det är inte publicerat. */
export const DRAFT_STATUSES: ContentStatus[] = ['draft', 'review']

export interface DraftItem {
  id: string
  table: string
  label: string
  title: string
  status: ContentStatus
  updated_at: string
  created_by: string | null
  editPath: string
  hasAuthor: boolean
}

export type DraftSort = 'updated_desc' | 'updated_asc' | 'title_asc' | 'type_asc'

export const DRAFT_SORT_LABELS: Record<DraftSort, string> = {
  updated_desc: 'Senast ändrad',
  updated_asc: 'Äldst ändrad',
  title_asc: 'Titel A–Ö',
  type_asc: 'Innehållstyp',
}

export function sortDrafts(items: DraftItem[], sort: DraftSort): DraftItem[] {
  const out = [...items]
  const time = (s: string) => new Date(s).getTime() || 0
  switch (sort) {
    case 'updated_asc': return out.sort((a, b) => time(a.updated_at) - time(b.updated_at))
    case 'title_asc': return out.sort((a, b) => a.title.localeCompare(b.title, 'sv'))
    case 'type_asc': return out.sort((a, b) => a.label.localeCompare(b.label, 'sv') || time(b.updated_at) - time(a.updated_at))
    default: return out.sort((a, b) => time(b.updated_at) - time(a.updated_at))
  }
}
