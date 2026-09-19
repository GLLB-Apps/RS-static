import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { pageBySlug } from './pages'
import type { ContentBlock } from './types'

interface PageData {
  title?: string
  intro?: string
  texts?: Record<string, string>
  blocks?: ContentBlock[]
}

// Reads a page's editable texts + block content from the `pages` collection,
// falling back to the defaults defined in pages.ts. `text(key)` resolves the
// extra per-page fields (form labels etc.); `blocks` is free-form content.
export function usePage(slug: string) {
  const cfg = pageBySlug(slug)
  const [data, setData] = useState<PageData | null>(null)

  useEffect(() => {
    let active = true
    supabase.from('pages').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (active) setData(data as PageData | null)
    })
    return () => { active = false }
  }, [slug])

  const texts = data?.texts ?? {}

  return {
    title: data?.title || cfg?.defaultTitle || '',
    intro: (data?.intro ?? cfg?.defaultIntro) || '',
    // A saved value always wins – including an empty one, so a text can be
    // cleared in the admin to hide it instead of snapping back to the default.
    text: (key: string) =>
      typeof texts[key] === 'string' ? texts[key] : (cfg?.fields?.find(f => f.key === key)?.default ?? ''),
    blocks: Array.isArray(data?.blocks) ? data.blocks : [],
  }
}
