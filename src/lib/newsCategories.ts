// Kategorierna på nyhetssidan. Fast uppsättning i koden (som avsändartyperna på
// dokument) så att färg, ordning och etikett hänger ihop överallt – lägg till en
// rad här om det behövs en till.
import type { Post } from './types'

export interface NewsCategory {
  /** Sparas i posts.category. */
  key: string
  label: string
  /** Kort förklaring i redigeraren. */
  hint: string
  /** Badge-klass, samma uppsättning som resten av sajten. */
  badge: string
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  { key: 'nyhet', label: 'Nyhet', hint: 'Egen nyhet eller uppdatering från initiativet.', badge: 'badge' },
  { key: 'pressklipp', label: 'Pressklipp', hint: 'Media har rapporterat – länka till artikeln eller inslaget.', badge: 'badge-warning' },
  { key: 'kronika', label: 'Krönika & debatt', hint: 'Krönikor, insändare och debattinlägg.', badge: 'badge-success' },
  { key: 'pressmeddelande', label: 'Pressmeddelande', hint: 'Utskick från initiativet till media.', badge: 'badge-error' },
]

export const DEFAULT_NEWS_CATEGORY = 'nyhet'

export const newsCategory = (key: string | null | undefined) =>
  NEWS_CATEGORIES.find(c => c.key === key)

export const newsCategoryLabel = (key: string | null | undefined) =>
  newsCategory(key)?.label ?? newsCategory(DEFAULT_NEWS_CATEGORY)!.label

export const newsCategoryBadge = (key: string | null | undefined) =>
  newsCategory(key)?.badge ?? 'badge-muted'

/** Taggar tål att komma från ett textfält eller en äldre post utan taggar. */
export function postTags(post: Pick<Post, 'tags'>): string[] {
  return Array.isArray(post.tags) ? post.tags.filter(t => typeof t === 'string' && t.trim()) : []
}

/** "Rögle kloster, P4" → ['Rögle kloster', 'P4'] (dubbletter bort, ordning kvar). */
export function parseTags(value: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value.split(/[,\n]/)) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    const key = tag.toLowerCase()
    if (tag && !seen.has(key)) { seen.add(key); out.push(tag) }
  }
  return out
}

/**
 * Ordnar om en fallande lista så att de tyngsta hamnar i mitten och de lättaste
 * ytterst – det är den placeringen som får ett taggmoln att läsas som en massa
 * i stället för som en lista.
 */
export function centerWeighted<T>(items: T[]): T[] {
  const left: T[] = []
  const right: T[] = []
  items.forEach((item, i) => (i % 2 === 0 ? right : left).push(item))
  return [...left.reverse(), ...right]
}

/**
 * Räknar hur ofta varje tagg förekommer och ger den en vikt 0–1, som
 * taggmolnet använder till textstorlek. Ensam tagg får full vikt.
 */
export function tagCloud(posts: Pick<Post, 'tags'>[]): { tag: string; count: number; weight: number }[] {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const post of posts) {
    for (const tag of postTags(post)) {
      const key = tag.toLowerCase()
      const entry = counts.get(key)
      if (entry) entry.count += 1
      else counts.set(key, { tag, count: 1 })
    }
  }
  const list = [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'sv'))
  const max = list[0]?.count ?? 1
  const min = list[list.length - 1]?.count ?? 1
  return list.map(e => ({ ...e, weight: max === min ? 1 : (e.count - min) / (max - min) }))
}
