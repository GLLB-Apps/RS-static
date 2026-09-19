// Sidfotens redigerbara texter. De bor i `pages`-dokumentet 'sidfot' och
// använder samma texts-lagring som vanliga sidor, så sidfoten går att redigera
// utan nya databasattribut. Redigeras i adminpanelen under Webbplats → Sidfot.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const FOOTER_SLUG = 'sidfot'

export interface FooterLink { label: string; url: string }

export interface FooterField {
  key: string
  label: string
  default: string
  multiline?: boolean
  hint?: string
}

// Standardtexterna är sidfotens ursprungliga, hårdkodade innehåll. Ett sparat
// värde vinner alltid – även ett tomt, som betyder "visa inte".
export const FOOTER_FIELDS: FooterField[] = [
  {
    key: 'brand_text', label: 'Text under webbplatsnamnet', multiline: true,
    default: 'Ett oberoende medborgarinitiativ som samlar information, dokument och vittnesmål om den planerade bergtäkten mellan Södra Sandby och Dalby.',
    hint: 'Rubriken och undertiteln ovanför hämtas från webbplatsinställningarna.',
  },
  { key: 'links_heading', label: 'Rubrik: länkkolumn', default: 'Engagera dig' },
  { key: 'contact_heading', label: 'Rubrik: kontaktkolumn', default: 'Kontakt' },
  {
    key: 'contact_note', label: 'Text i kontaktkolumnen', multiline: true,
    default: 'Har du tips, bilder eller frågor? Hör gärna av dig.',
    hint: 'E-post och telefon hämtas från webbplatsinställningarna.',
  },
  {
    key: 'copyright', label: 'Rad längst ned (copyright)', multiline: true,
    default: '© {year} {site}. Exempeldata — inte verifierade fakta utan källhänvisning.',
    hint: '{year} blir årtalet och {site} webbplatsens namn. Lämna tomt för att dölja raden helt.',
  },
  { key: 'to_top', label: 'Knapptext: till toppen', default: 'Till toppen ↑', hint: 'Lämna tomt för att dölja knappen.' },
]

// Länkkolumnen lagras som en rad per länk: "Etikett | /adress".
export const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { label: 'Lämna ett vittnesmål', url: '/vittnesmal' },
  { label: 'Kontakta initiativet', url: '/kontakt' },
  { label: 'Vanliga frågor', url: '/fragor-och-svar' },
]

export const FOOTER_LINKS_KEY = 'links'
/** '0' döljer kampanjlänken (namninsamling/donation) överst i länkkolumnen. */
export const FOOTER_CTA_KEY = 'links_cta'

export function parseFooterLinks(value: string): FooterLink[] {
  return value
    .split('\n')
    .map(line => {
      const i = line.indexOf('|')
      return i === -1
        ? { label: line.trim(), url: '' }
        : { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() }
    })
    .filter(l => l.label && l.url)
}

export function serializeFooterLinks(links: FooterLink[]): string {
  return links
    .map(l => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter(l => l.label && l.url)
    .map(l => `${l.label} | ${l.url}`)
    .join('\n')
}

/** Ersätter {year} och {site} i en sidfotstext. */
export function fillFooterTokens(value: string, siteName: string): string {
  return value.replace(/\{year\}/g, String(new Date().getFullYear())).replace(/\{site\}/g, siteName)
}

export const footerDefault = (key: string) => FOOTER_FIELDS.find(f => f.key === key)?.default ?? ''

/**
 * Läser sidfotens texter. `null` medan de hämtas – sidfoten renderas inte då,
 * så en borttagen text aldrig hinner blinka förbi i standardutförande.
 */
export function useFooterTexts(): Record<string, string> | null {
  const [texts, setTexts] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    let active = true
    supabase.from('pages').select('*').eq('slug', FOOTER_SLUG).maybeSingle().then(({ data, error }) => {
      if (!active) return
      const saved = (data as { texts?: Record<string, string> } | null)?.texts
      // Vid fel (eller inget sparat) visas standardtexterna.
      setTexts(error || !saved || typeof saved !== 'object' ? {} : saved)
    })
    return () => { active = false }
  }, [])
  return texts
}

/** Slår upp en sidfotstext: sparat värde vinner, annars standardtexten. */
export function footerText(texts: Record<string, string>, key: string): string {
  return typeof texts[key] === 'string' ? texts[key] : footerDefault(key)
}
