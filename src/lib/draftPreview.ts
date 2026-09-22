// Gemensamt för allt som visar ett autosparat utkast utifrån dess råa,
// odokumenterade form (se t.ex. TopicDraft i AdminTopicEdit.tsx) — delad
// mellan DraftRecoveryDialog.tsx (den globala "Välkommen tillbaka"-dialogen)
// och AdminDrafts.tsx (Utkast-sidans "Mina utkast").
import type { ContentBlock } from './types'

/** Vilken redigerare (nyckelns "kind") som hör till vilken sida, och hur man bygger dess adress ur nyckelns "rest". */
export const DRAFT_ROUTE_FOR: Record<string, (rest: string) => string> = {
  topic: rest => `/admin/amnen/${rest === 'new' ? 'ny' : rest}`,
  news: rest => `/admin/nyheter/${rest === 'new' ? 'ny' : rest}`,
  page: rest => `/admin/sidor/${rest}`,
  'custom-page': rest => `/admin/egna-sidor/${rest === 'new' ? 'ny' : rest}`,
  background: () => '/admin/bakgrund',
}

export const DRAFT_KIND_LABEL: Record<string, string> = {
  topic: 'Ämnesområde',
  news: 'Nyhet',
  page: 'Sida',
  'custom-page': 'Fristående sida',
  background: 'Bakgrund',
}

export interface DraftPreview {
  title: string
  excerpt: string
  blocks: ContentBlock[]
}

/** Utkastets form skiljer sig per redigerare — plockar ut det som är gemensamt att visa. */
export function previewForDraft(kind: string, value: unknown): DraftPreview {
  const v = (value ?? {}) as Record<string, unknown>
  switch (kind) {
    case 'topic':
    case 'page':
    case 'custom-page':
      return {
        title: typeof v.title === 'string' ? v.title : '',
        excerpt: typeof v.intro === 'string' ? v.intro : '',
        blocks: Array.isArray(v.content) ? v.content as ContentBlock[] : Array.isArray(v.blocks) ? v.blocks as ContentBlock[] : [],
      }
    case 'news': {
      const form = (v.form ?? {}) as Record<string, unknown>
      return {
        title: typeof form.title === 'string' ? form.title : '',
        excerpt: typeof form.excerpt === 'string' ? form.excerpt : '',
        blocks: Array.isArray(v.content) ? v.content as ContentBlock[] : [],
      }
    }
    case 'background':
      return { title: '', excerpt: '', blocks: Array.isArray(v.blocks) ? v.blocks as ContentBlock[] : [] }
    default:
      return { title: '', excerpt: '', blocks: [] }
  }
}
