export type ContentStatus = 'draft' | 'review' | 'published' | 'archived'
export type TestimonyStatus = 'pending' | 'approved' | 'rejected' | 'archived'
export type UserRole = 'superadmin' | 'redaktor' | 'skribent'
export type SenderType = 'ncc' | 'lund_kommun' | 'authority' | 'media' | 'initiative' | 'private'
export type MediaType = 'image' | 'video' | 'map' | 'graphic' | 'press_image'
export type MapPointType = 'work_area' | 'quarry_area' | 'property_border' | 'transport_route' | 'residence_distance' | 'nature_value' | 'walking_trail' | 'observation_point' | 'photo_point' | 'testimony_point'

/** Kolumnblockets ("Kolumner") en av två spalter — bredd i procent (summerar till 100) och egna, nästlade block. */
export interface LayoutColumn {
  width: number
  blocks: ContentBlock[]
}

export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'quote' | 'factbox' | 'warning' | 'image' | 'gallery' | 'video' | 'document_list' | 'links' | 'divider' | 'button' | 'related' | 'sources' | 'comparison' | 'faq' | 'list' | 'cta' | 'resource' | 'table' | 'columns'
  text?: string
  title?: string
  url?: string
  /** Rubriknivå 1–6 (markdownens # … ######). Saknas den är rubriken nivå 2. */
  level?: number
  /** Knapptext för t.ex. resurs-blocket ("Öppna enkäten"). */
  button_label?: string
  items?: string[]
  image_url?: string
  alt_text?: string
  video_url?: string
  links?: { label: string; url: string }[]
  sources?: { label: string; url: string }[]
  rows?: { label: string; value: string }[]
  /** Tabellblock: rubrikraden. Tom lista = tabell utan rubrikrad. */
  columns?: string[]
  /** Tabellblock: en lista per rad, med en cell per kolumn. */
  cells?: string[][]
  /** Kolumnblock ("Kolumner"): två spalter sida vid sida, se LayoutColumn. */
  layout_columns?: LayoutColumn[]
}

export interface SiteSettings {
  id: string
  site_name: string
  site_subtitle: string
  logo_url: string | null
  favicon_url: string | null
  petition_url: string
  /**
   * 'petition' visar namninsamling/underskrifter, 'donate' ersätter med ett
   * donationsflöde, 'consult' leder vidare till kontaktsidan för samrådet.
   */
  campaign_mode: 'petition' | 'donate' | 'consult' | 'none'
  donate_url: string | null
  donate_title: string | null
  donate_text: string | null
  donate_button: string | null
  /**
   * Mottagaradressen i samrådsläget — mejlet öppnas i besökarens eget program.
   * Tom = NCC:s samrådsadress. Hette så här när läget i stället länkade till
   * kontaktsidan; fältet är kvar för att slippa migrera en ny kolumn.
   */
  consult_url: string | null
  consult_title: string | null
  consult_text: string | null
  consult_button: string | null
  /** Ämnesraden som fylls i åt besökaren. */
  consult_subject: string | null
  /**
   * Texterna i mellanlandningsrutan som visas innan besökarens mejlprogram
   * öppnas. Tomt fält = den inbyggda standardtexten (se MAIL_DIALOG i campaign.ts).
   */
  consult_dialog_title: string | null
  consult_dialog_text: string | null
  consult_dialog_note: string | null
  consult_dialog_confirm: string | null
  consult_dialog_cancel: string | null
  default_share_image: string | null
  contact_email: string | null
  contact_phone: string | null
  /** Hur kontaktformulärets meddelanden tas emot. */
  contact_delivery: 'system' | 'email' | 'both' | null
  /** Mottagar-e-post för utskick via Resend (faller tillbaka på contact_email). */
  contact_recipient: string | null
  /** Avsändaradress för Resend, t.ex. "Kontakt <kontakt@dindomän.se>". */
  contact_from: string | null
  social_links: Record<string, string>
  footer_text: string | null
  privacy_text: string | null
  cookie_text: string | null
  status_message: string | null
  status_phase: string | null
  /**
   * Enstaka viktigt datum — ersatt av `important_dates`, men kvar som reserv
   * för inställningar som sparades innan listan fanns.
   */
  next_important_date: string | null
  /** Kommande viktiga datum. Startsidan visar det närmast kommande. */
  important_dates: ImportantDate[]
  signature_count: number
  hero_title: string
  hero_intro: string
  hero_image: string | null
  hero_buttons: HeroButton[]
  background_blocks: ContentBlock[]
  /**
   * Styr Rögleblobbarna (de interaktiva avatarerna): 'off' = inga alls,
   * 'admin' = bara i adminpanelen/intranätet, 'everywhere' = även publikt.
   * Osatt (äldre rader) tolkas som 'everywhere' — se blobSettings.tsx.
   */
  blob_avatars: 'off' | 'admin' | 'everywhere' | null
  /**
   * Innehållets maxbredd i pixlar (.container-narrow) — bara till för att
   * ge kolumnblocket ("Kolumner") mer plats. Kan bara göras BREDARE än
   * standard (800), aldrig smalare. Osatt (äldre rader) = 800.
   */
  content_width: number | null
}

/**
 * Ett kommande viktigt datum i processen. Startsidan väljer själv det första
 * som inte passerat, så listan behöver inte städas när ett datum infaller.
 */
export interface ImportantDate {
  /** ISO-datum, YYYY-MM-DD. */
  date: string
  /** Vad som händer, t.ex. "Samrådet stänger". */
  label: string
}

/** En knapp i heron. `cta: true` följer kampanjläget (namninsamling/donation). */
export interface HeroButton {
  label: string
  url: string
  style: 'primary' | 'secondary'
  cta?: boolean
}

/** Admin-skapad sida som renderas med block-editorn, på toppnivå-adress /slug. */
export interface CustomPage {
  id: string
  slug: string
  title: string
  intro: string | null
  blocks: ContentBlock[]
  status: ContentStatus
  sort_order: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
}

export interface Topic {
  id: string
  title: string
  slug: string
  intro: string | null
  content: ContentBlock[]
  status: ContentStatus
  featured_image: string | null
  icon: string | null
  sort_order: number
  created_by: string | null
  updated_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: ContentBlock[]
  featured_image: string | null
  image_caption: string | null
  author: string | null
  status: ContentStatus
  is_pinned: boolean
  /** 'nyhet' | 'pressklipp' | 'kronika' | 'pressmeddelande' – se lib/newsCategories.ts. */
  category: string | null
  /** Fria taggar, driver taggmolnet på nyhetssidan. */
  tags: string[]
  /** Var materialet publicerades, t.ex. "Sveriges Radio P4 Extra". */
  source: string | null
  /** Länk till originalartikeln/inslaget. */
  external_url: string | null
  seo_title: string | null
  seo_description: string | null
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface Testimony {
  id: string
  title: string | null
  story: string
  /**
   * Visningsnamnet. Tomt när vittnesmålet är anonymt — det riktiga namnet
   * ligger i `testimony_contacts`, som bara admin kan läsa.
   */
  author_name: string | null
  is_anonymous: boolean
  /** @deprecated Ligger i `testimony_contacts`. Kvar för äldre rader. */
  email: string | null
  location: string | null
  area_usage: string | null
  featured_image: string | null
  map_lat: number | null
  map_lng: number | null
  status: TestimonyStatus
  consent_publish: boolean
  consent_contact: boolean
  consent_marketing: boolean
  /** @deprecated Ligger i `testimony_contacts`. Kvar för äldre rader. */
  internal_note: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Vittnesmålets känsliga sidor, avskilda från det publika dokumentet.
 *
 * Ett godkänt vittnesmål är läsbart för vem som helst, och Appwrite har ingen
 * behörighet per fält — låg e-posten kvar i samma dokument låg den öppet. Den
 * här kollektionen får skapas av utloggade besökare (formuläret) men läsas bara
 * av admin.
 */
export interface TestimonyContact {
  id: string
  testimony_id: string
  email: string | null
  /** Riktigt namn, även när vittnesmålet publiceras anonymt. */
  author_name: string | null
  internal_note: string | null
  created_at: string
  updated_at: string
}

export interface DocumentItem {
  id: string
  title: string
  description: string | null
  file_url: string | null
  external_url: string | null
  document_date: string | null
  sender: string | null
  sender_type: SenderType | null
  file_type: string | null
  source: string | null
  status: ContentStatus
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface MediaItem {
  id: string
  title: string
  description: string | null
  alt_text: string | null
  photographer: string | null
  media_date: string | null
  location: string | null
  media_type: MediaType
  file_url: string | null
  video_url: string | null
  rights_info: string | null
  is_press_allowed: boolean
  marketing_ok: boolean
  status: ContentStatus
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface MapLocation {
  id: string
  title: string
  description: string | null
  lat: number
  lng: number
  point_type: MapPointType
  /** Valfri Lucide-ikon (kebab-case). Faller tillbaka på punkttypens ikon. */
  icon: string | null
  image_url: string | null
  source: string | null
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

// ---- Intranät -------------------------------------------------------------
// Inloggningsskyddad yta för projektgrupper och aktiva. Åtkomst styrs av
// Appwrite-labeln "member" (eller "admin"), inte av user_roles.

export interface IntranetMember {
  id: string
  user_id: string
  display_name: string | null
  email: string | null
  added_by: string | null
  note: string | null
  /** true = läsbehörighet (Appwrite-labeln "viewer"); false = full medlem. */
  read_only: boolean
  created_at: string
  updated_at: string
}

export interface IntranetNote {
  id: string
  title: string
  body: string | null
  category: string | null
  pinned: boolean
  created_by: string | null
  created_by_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface IntranetTask {
  id: string
  text: string
  done: boolean
  list: string | null
  assignee: string | null
  due_date: string | null
  created_by: string | null
  done_by: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface IntranetNotice {
  id: string
  title: string
  body: string | null
  author: string | null
  author_id: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

/** Ett hörn i en polygon, [latitud, longitud] — samma ordning som Leaflet. */
export type LatLngTuple = [number, number]

export type MapAreaLineStyle = 'solid' | 'dashed'

export interface MapArea {
  id: string
  title: string
  description: string | null
  /** Linjefärg som hex, t.ex. "#b94a3d". Fyllningen använder samma färg. */
  color: string
  line_style: MapAreaLineStyle
  fill_opacity: number
  /** Valfri Lucide-ikon (kebab-case) som visas i teckenförklaringen. */
  icon: string | null
  /** Visas i popupen när någon klickar på området — samma stil som vittnesmålens bild. */
  image_url: string | null
  /** Yttre ring i ritordning. Stängs automatiskt — upprepa inte första punkten. */
  points: LatLngTuple[]
  sort_order: number
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface TimelineEvent {
  id: string
  event_date: string
  title: string
  description: string | null
  event_type: string | null
  link_url: string | null
  related_document_id: string | null
  image_url: string | null
  status: ContentStatus
  published_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FaqCategory {
  id: string
  name: string
  slug: string
  sort_order: number
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category_id: string | null
  sort_order: number
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  is_public: boolean
  sort_order: number
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string | null
  message: string
  status: 'unread' | 'read' | 'handled' | 'archived'
  internal_note: string | null
  created_at: string
  updated_at: string
}

export interface InternalDocCategory {
  id: string
  name: string
  sort_order: number
}

export interface InternalDocument {
  id: string
  title: string
  description: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  category_id: string | null
  owner: string | null
  uploaded_by: string | null
  uploaded_by_id: string | null
  created_at: string
  updated_at: string
}

export interface Sponsor {
  id: string
  name: string
  image_url: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NavigationItem {
  id: string
  label: string
  url: string
  icon: string | null
  sort_order: number
  is_active: boolean
  parent_id: string | null
}

export interface UserProfile {
  id: string
  display_name: string | null
  /** Presentationen personen skrev när kontot skapades. */
  intro: string | null
}

/** En post i systemets ändringslogg (adminpanelen → Ändringslogg). */
export type ChangelogCategory = 'feature' | 'improvement' | 'fix' | 'other'

export interface ChangelogEntry {
  id: string
  title: string
  body: string | null
  /** ISO-datum, YYYY-MM-DD. Listan sorteras fallande på det här fältet. */
  entry_date: string | null
  category: ChangelogCategory | null
  version: string | null
  /** Sha:t på commiten posten importerades från. null = skriven för hand. */
  commit_sha: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

/** En sparad Lucide-ikon utanför den kurerade uppsättningen. */
export interface CustomIcon {
  id: string
  /** Lucide-namn i kebab-case, t.ex. "anchor". */
  name: string
  label: string | null
  added_by: string | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}
