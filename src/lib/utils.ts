import type { ContentBlock, ImportantDate, LatLngTuple, SiteSettings } from './types'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[äÄ]/g, 'a')
    .replace(/[åÅ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Användarnamnet ur en e-postadress, för en vänligare hälsning än hela adressen. */
export function usernameFromEmail(email: string): string {
  return email.split('@')[0] || email
}

export function formatDate(date: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('sv-SE', opts ?? { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Dagens datum som YYYY-MM-DD i lokal tid — jämförbart med sparade datum. */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Kommande datum först, passerade bortsorterade. Sorterar på ISO-strängen. */
export function upcomingDates(dates: ImportantDate[] | null | undefined): ImportantDate[] {
  const today = todayIso()
  return (dates ?? [])
    .filter(d => d?.date && d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Nästa viktiga datum. Läser listan `important_dates` och tar det första som
 * inte passerat — därför byter startsidan av sig själv när dagen infaller.
 * Faller tillbaka på det gamla enskilda fältet för inställningar som sparades
 * innan listan fanns. null = inget kommande datum.
 */
export function nextImportantDate(settings: SiteSettings | null): ImportantDate | null {
  const next = upcomingDates(settings?.important_dates)[0]
  if (next) return next
  const legacy = settings?.next_important_date
  return legacy && legacy >= todayIso() ? { date: legacy, label: '' } : null
}

export function senderTypeLabel(type: string | null): string {
  const map: Record<string, string> = {
    ncc: 'NCC',
    lund_kommun: 'Lunds kommun',
    authority: 'Myndighet',
    media: 'Media',
    initiative: 'Initiativet',
    private: 'Privatperson',
  }
  return type ? (map[type] ?? type) : 'Okänd'
}

export function senderTypeBadge(type: string | null): string {
  const map: Record<string, string> = {
    ncc: 'badge-error',
    lund_kommun: 'badge',
    authority: 'badge-warning',
    media: 'badge-muted',
    initiative: 'badge-success',
    private: 'badge-muted',
  }
  return type ? (map[type] ?? 'badge-muted') : 'badge-muted'
}

export function mediaTypeLabel(type: string): string {
  const map: Record<string, string> = {
    image: 'Bild',
    video: 'Video',
    map: 'Karta',
    graphic: 'Grafik',
    press_image: 'Pressbild',
  }
  return map[type] ?? type
}

export function mapPointTypeLabel(type: string): string {
  const map: Record<string, string> = {
    work_area: 'Verksamhetsområde',
    quarry_area: 'Brytområde',
    property_border: 'Fastighetsgräns',
    transport_route: 'Transportväg',
    residence_distance: 'Närmaste bostad',
    nature_value: 'Naturvärde',
    walking_trail: 'Promenadstråk',
    observation_point: 'Observationspunkt',
    photo_point: 'Fotopunkt',
    testimony_point: 'Vittnesmålspunkt',
  }
  return map[type] ?? type
}

// Default Lucide icon (kebab-case) per point type. All names are in the curated
// registry (src/lib/lucide.tsx) so they render synchronously without pulling in
// the full library. A point's own `icon` overrides this when set.
export function mapPointTypeIconName(type: string): string {
  const map: Record<string, string> = {
    work_area: 'construction',
    quarry_area: 'mountain',
    property_border: 'ruler',
    transport_route: 'truck',
    residence_distance: 'house',
    nature_value: 'trees',
    walking_trail: 'footprints',
    observation_point: 'eye',
    photo_point: 'camera',
    testimony_point: 'message-circle',
  }
  return map[type] ?? 'map-pin'
}

// Great-circle distance between two lat/lng points, in metres.
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Human-friendly distance, e.g. "1,8 km" or "740 m".
export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`
  return `${Math.round(m / 10) * 10} m`
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    superadmin: 'Superadmin',
    redaktor: 'Redaktör',
    skribent: 'Skribent',
  }
  return map[role] ?? role
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Utkast',
    review: 'Väntar på granskning',
    published: 'Publicerad',
    archived: 'Arkiverad',
    pending: 'Väntar på granskning',
    approved: 'Godkänd',
    rejected: 'Avslagen',
    unread: 'Oläst',
    read: 'Läst',
    handled: 'Hanterat',
  }
  return map[status] ?? status
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    published: 'badge-success',
    approved: 'badge-success',
    handled: 'badge-success',
    draft: 'badge-muted',
    archived: 'badge-muted',
    rejected: 'badge-error',
    review: 'badge-warning',
    pending: 'badge-warning',
    unread: 'badge-warning',
    read: 'badge-muted',
  }
  return map[status] ?? 'badge-muted'
}

/** Rubriknivåerna, samma sex som markdownens # … ######. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

/**
 * Nivån på ett rubrikblock. Sidans egen titel är h1, så en rubrik i innehållet
 * är nivå 2 om inget annat valts — det gäller även alla rubriker som skrevs
 * innan nivåerna fanns.
 */
export function headingLevel(level: number | undefined | null): number {
  const n = Math.round(Number(level))
  return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 2
}

// En adress som skrivs in i editorn ska bete sig rätt utan att redaktören
// behöver välja "intern" eller "extern": normalizeUrl gör om det som skrivits
// till en användbar adress, och internalPath avgör om den leder till sajten
// själv (då navigeras den utan omladdning) eller bort från den (då öppnas den
// i ett nytt fönster).

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
// "lund.se", "www.lund.se/planer?x=1" – en domän utan protokoll.
const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+([/?#]|$)/

/** "www.lund.se" → "https://www.lund.se". Interna sökvägar lämnas orörda. */
export function normalizeUrl(url: string | null | undefined): string {
  const u = (url ?? '').trim()
  if (!u) return ''
  if (u.startsWith('/') || u.startsWith('#')) return u
  if (u.startsWith('//')) return 'https:' + u
  if (HAS_SCHEME.test(u)) return u
  if (BARE_DOMAIN.test(u)) return 'https://' + u
  return u
}

/**
 * Sökvägen inom sajten om adressen pekar hit (även när den skrivits som full
 * adress till den egna domänen), annars null – dvs. "det här är en extern
 * länk".
 */
export function internalPath(url: string | null | undefined): string | null {
  const u = normalizeUrl(url)
  if (!u) return null
  if (u.startsWith('/') || u.startsWith('#')) return u
  if (!/^https?:\/\//i.test(u)) return null
  if (typeof window === 'undefined') return null
  try {
    const parsed = new URL(u)
    if (parsed.origin !== window.location.origin) return null
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return null
  }
}

/** true när länken leder bort från sajten och alltså ska öppnas i nytt fönster. */
export function isExternalUrl(url: string | null | undefined): boolean {
  return normalizeUrl(url) !== '' && internalPath(url) === null
}

/**
 * Delar text i stycken vid tomma rader, som markdown (och som Skift+Enter
 * skriver in i TapEditor). En ensam radbrytning är mjuk och rinner ihop till
 * ett mellanslag när texten renderas.
 */
export function splitParagraphs(text: string | null | undefined): string[] {
  return (text ?? '').split(/\n[^\S\n]*\n/).filter(p => p.trim())
}

/**
 * Första bilden i ett innehåll, för kort som saknar egen huvudbild (t.ex.
 * nyhetskort på startsidan och i nyhetslistan).
 */
export function firstContentImage(blocks: ContentBlock[] | null | undefined): string | null {
  return blocks?.find(b => b.type === 'image' && b.image_url)?.image_url ?? null
}

export interface ContentStats {
  words: number
  paragraphs: number
  blocks: number
  /** Läshastighet ~200 ord/minut, avrundat uppåt — aldrig 0 så länge något är skrivet. */
  readingMinutes: number
}

/** Räknar rakt igenom, inklusive kolumnblockets nästlade block — annars
 * skulle text i en kolumnruta osynligt saknas i ord- och lästidssumman. */
function flattenBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.flatMap(b => b.type === 'columns'
    ? [b, ...flattenBlocks((b.layout_columns ?? []).flatMap(c => c.blocks))]
    : [b])
}

/** Ord/stycken/lästid över hela innehållet, för redigerarens sidofält. */
export function contentStats(blocks: ContentBlock[]): ContentStats {
  const flat = flattenBlocks(blocks)
  let words = 0
  for (const b of flat) {
    const texts = [b.text, b.title, ...(b.items ?? [])].filter((t): t is string => !!t?.trim())
    for (const t of texts) words += (t.trim().match(/\S+/g) ?? []).length
  }
  const paragraphs = flat.filter(b => b.type === 'paragraph' && b.text?.trim()).length
  return { words, paragraphs, blocks: flat.length, readingMinutes: words > 0 ? Math.max(1, Math.round(words / 200)) : 0 }
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

/**
 * Samma frö som vittnesmålsformuläret skapar figuren av medan man skriver
 * (se TestimonyForm.tsx: namn + berättelse, eller bara berättelsen om
 * anonymt) — måste vara identiskt överallt vittnesmålets blob visas EFTER
 * inskicket (admin, listan, den egna sidan, kartan), annars byter personen
 * figur mellan att skriva och att se sitt eget vittnesmål igen.
 */
export function testimonyBlobSeed(name: string, story: string, anonymous: boolean): string {
  if (anonymous) return story || 'rögleskogen'
  return story.trim() ? `${name}|${story}` : (name || 'rögleskogen')
}

/** Padding för fitBounds, delad så att kartorna ramas in likadant. */
export const MAP_FIT_PADDING: [number, number] = [24, 24]

/** Alla hörn från angivna områden, för att rama in en karta kring dem. */
export function areaBounds(areas: { points: LatLngTuple[] }[]): LatLngTuple[] {
  return areas.flatMap(a => a.points)
}

/**
 * Tolkar inklistrade koordinater, en per rad som "latitud, longitud" — formatet
 * man får när man kopierar en punkt från Google Maps. Rader som inte går att
 * tolka rapporteras tillbaka så att redaktören kan rätta dem.
 */
export function parseCoordinateText(text: string): { points: LatLngTuple[]; errors: string[] } {
  const points: LatLngTuple[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const m = line.match(/^\[?\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*\]?,?$/)
    if (!m) { errors.push(`Rad ${i + 1}: kunde inte tolkas — "${line}"`); return }
    const lat = Number(m[1].replace(',', '.'))
    const lng = Number(m[2].replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { errors.push(`Rad ${i + 1}: ogiltigt tal`); return }
    if (lat < -90 || lat > 90) { errors.push(`Rad ${i + 1}: latitud ${lat} ligger utanför -90–90. Är lat och long omkastade?`); return }
    if (lng < -180 || lng > 180) { errors.push(`Rad ${i + 1}: longitud ${lng} ligger utanför -180–180`); return }
    points.push([lat, lng])
  })
  return { points, errors }
}

/** Ungefärlig area i km², för att visa storleken på ett ritat område. */
export function polygonAreaKm2(points: LatLngTuple[]): number {
  if (points.length < 3) return 0
  const latRad = (points[0][0] * Math.PI) / 180
  const x = (p: LatLngTuple) => p[1] * Math.cos(latRad)
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    sum += x(a) * b[0] - x(b) * a[0]
  }
  return Math.abs(sum / 2) * 111.32 ** 2
}
