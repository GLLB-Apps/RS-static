// Config for editable "pages" (WordPress-style). Each entry maps a public
// page to its editable static texts (title + intro + extra fields) and
// shortcuts to the dynamic-content managers that live on that page.
export interface PageManageLink { label: string; to: string }

// Extra editable text on a page (beyond title + intro), e.g. form labels.
// `type: 'number'` is still stored as text – it only changes the input in the
// admin and signals that the page parses the value as a number.
export interface PageField {
  key: string
  label: string
  default: string
  multiline?: boolean
  type?: 'number'
  hint?: string
}

export interface PageConfig {
  slug: string          // document id / key in the `pages` collection
  label: string         // label in the admin
  route: string         // public route
  defaultTitle: string
  defaultIntro: string
  manage: PageManageLink[]
  fields?: PageField[]
  headerless?: boolean  // page has no title/intro header (e.g. the start page)
  hasBlocks?: boolean   // page renders free-form block content (pages.blocks)
}

export const PAGES: PageConfig[] = [
  {
    slug: 'hem', label: 'Startsida', route: '/', defaultTitle: 'Startsida', defaultIntro: '', headerless: true,
    manage: [{ label: 'Redigera hero (bild, text, knappar)', to: '/admin/hero' }, { label: 'Webbplatsinställningar', to: '/admin/inställningar' }],
    // Startsidans texter ligger i "fields" nedan: statusrutan, de tre blocken
    // under sammanfattningen, ämnes- och nyhetsrubrikerna samt uppmaningen.
    fields: [
      { key: 'status_heading', label: 'Status: rubrik', default: 'Aktuell status' },
      { key: 'status_intro', label: 'Status: text', default: 'Översikt över var i processen vi befinner oss.' },
      { key: 'summary_heading', label: 'Rubrik över de tre blocken', default: 'Kort sammanfattning', hint: 'Står ovanför blocken nedan.' },
      { key: 'card1_title', label: 'Block 1 – rubrik', default: 'Vad planeras?', hint: 'De tre blocken ligger i rad på startsidan, i den ordning de står här.' },
      { key: 'card1_text', label: 'Block 1 – text', multiline: true, default: 'NCC har informerat om planer på att ansöka om tillstånd för en ny bergtäkt i Rögleskogen mellan Södra Sandby och Dalby i Lunds kommun.' },
      { key: 'card2_title', label: 'Block 2 – rubrik', default: 'Varför väcker det frågor?' },
      { key: 'card2_text', label: 'Block 2 – text', multiline: true, default: 'Boende och naturintresserade har frågor om buller, damm, trafik, naturvärden och påverkan på närmiljö och livsmiljö.' },
      { key: 'card3_title', label: 'Block 3 – rubrik', default: 'Vad händer nu?', hint: 'Rubriken är fri text – blocket heter "Vad händer nu?" tills du skriver om den.' },
      { key: 'card3_text', label: 'Block 3 – text', multiline: true, default: 'Processen befinner sig i ett tidigt skede. Information samlas här kontinuerligt. Håll dig uppdaterad via tidslinjen och nyheterna.' },
      { key: 'topics_heading', label: 'Ämnesområden: rubrik', default: 'Ämnesområden' },
      { key: 'topics_intro', label: 'Ämnesområden: text', default: 'Utforska olika aspekter av den planerade bergtäkten.' },
      { key: 'news_heading', label: 'Nyheter: rubrik', default: 'Senaste nytt' },
      { key: 'sponsors_heading', label: 'Sponsorer: rubrik', default: 'Med stöd av' },
      { key: 'cta_heading', label: 'Uppmaning: rubrik', default: 'Hjälp till att sprida informationen' },
      { key: 'cta_text', label: 'Uppmaning: text', multiline: true, default: 'Skriv under namninsamlingen, dela informationen eller lämna ditt vittnesmål.' },
    ],
  },
  {
    slug: 'bakgrund', label: 'Bakgrund', route: '/bakgrund', defaultTitle: 'Bakgrund',
    defaultIntro: 'Hur detta initiativ kom till och varför informationen samlas.',
    manage: [{ label: 'Redigera sidans innehåll (block)', to: '/admin/bakgrund' }],
  },
  { slug: 'nyheter', label: 'Nyheter', route: '/nyheter', defaultTitle: 'Nyheter', defaultIntro: 'Senaste information och uppdateringar om planerna.', manage: [{ label: 'Hantera nyheter', to: '/admin/nyheter' }] },
  { slug: 'amnen', label: 'Ämnesområden', route: '/amnen', defaultTitle: 'Ämnesområden', defaultIntro: 'Olika aspekter av den planerade bergtäkten, från naturvärden till buller och trafik.', manage: [{ label: 'Hantera ämnen', to: '/admin/amnen' }] },
  { slug: 'dokument', label: 'Dokument', route: '/dokument', defaultTitle: 'Dokumentarkiv', defaultIntro: 'Handlingar, brev, kartor och underlag kopplade till planerna.', manage: [{ label: 'Hantera dokument', to: '/admin/dokument' }] },
  { slug: 'media', label: 'Media', route: '/media', defaultTitle: 'Media', defaultIntro: 'Bilder, videor, kartor och grafik från området.', manage: [{ label: 'Hantera media', to: '/admin/media' }] },
  {
    slug: 'karta', label: 'Karta', route: '/karta', defaultTitle: 'Karta', defaultIntro: 'Det planerade området och intressanta punkter.',
    manage: [{ label: 'Hantera kartpunkter', to: '/admin/karta' }],
    fields: [
      { key: 'layers_heading', label: 'Rubrik: kartlager', default: 'Kartlager' },
      { key: 'layers_hint', label: 'Kartlager: text', default: 'Tryck på en punkttyp för att visa eller dölja den på kartan.', multiline: true },
    ],
  },
  { slug: 'tidslinje', label: 'Tidslinje', route: '/tidslinje', defaultTitle: 'Tidslinje', defaultIntro: 'Viktiga händelser i processen kring den planerade bergtäkten.', manage: [{ label: 'Hantera tidslinje', to: '/admin/tidslinje' }] },
  {
    slug: 'vittnesmal', label: 'Vittnesmål', route: '/vittnesmal', defaultTitle: 'Vittnesmål', defaultIntro: 'Berättelser och upplevelser från boende och besökare i Rögleskogen.',
    manage: [{ label: 'Hantera vittnesmål', to: '/admin/vittnesmal' }],
    fields: [
      { key: 'list_heading', label: 'Rubrik: publicerade', default: 'Publicerade vittnesmål' },
      { key: 'form_heading', label: 'Rubrik: formulär', default: 'Lämna ett vittnesmål' },
      { key: 'form_intro', label: 'Formulärets ingress', multiline: true, default: 'Ditt vittnesmål granskas av administratörer innan det publiceras. E-postadressen visas aldrig publikt.' },
      { key: 'label_title', label: 'Fält: Rubrik', default: 'Rubrik (valfritt)' },
      { key: 'label_story', label: 'Fält: Berättelse', default: 'Berättelse' },
      { key: 'label_area', label: 'Fält: Områdesanvändning', default: 'Hur använder du området?' },
      { key: 'label_name', label: 'Fält: Namn', default: 'Namn' },
      { key: 'label_location', label: 'Fält: Ort', default: 'Ort' },
      { key: 'label_email', label: 'Fält: E-post', default: 'E-post' },
      { key: 'email_hint', label: 'E-post: hjälptext', default: 'Visas aldrig publikt.' },
      { key: 'anonymous', label: 'Kryssruta: anonym', default: 'Publicera anonymt (namnet visas inte publikt)' },
      { key: 'consent_publish', label: 'Kryssruta: publicering', multiline: true, default: 'Jag godkänner att min berättelse behandlas och kan publiceras på webbplatsen' },
      { key: 'consent_contact', label: 'Kryssruta: kontakt', multiline: true, default: 'Administratörer får kontakta mig via e-post vid behov' },
      { key: 'review_hint', label: 'Granskningstext', multiline: true, default: 'Inskickat material granskas av administratörer före publicering.' },
      { key: 'submit', label: 'Knapptext', default: 'Skicka vittnesmål' },
      { key: 'success', label: 'Tack-meddelande', multiline: true, default: 'Tack! Ditt vittnesmål är inlämnat och väntar på granskning.' },
    ],
  },
  {
    slug: 'fragor-och-svar', label: 'Frågor och svar', route: '/fragor-och-svar', defaultTitle: 'Frågor och svar', defaultIntro: 'Vanliga frågor om den planerade bergtäkten och detta initiativ.',
    manage: [{ label: 'Hantera FAQ', to: '/admin/faq' }],
    fields: [{ key: 'uncategorized_heading', label: 'Rubrik: okategoriserade frågor', default: 'Övrigt' }],
  },
  {
    slug: 'kontakt', label: 'Kontakt', route: '/kontakt', defaultTitle: 'Kontakt',
    defaultIntro: 'Kontakta initiativet för frågor, information eller samarbete.',
    manage: [{ label: 'Kontaktpersoner', to: '/admin/kontakter' }, { label: 'Formulärmeddelanden', to: '/admin/meddelanden' }],
    fields: [
      { key: 'contacts_heading', label: 'Rubrik: kontaktpersoner', default: 'Kontaktpersoner' },
      { key: 'form_heading', label: 'Rubrik: formulär', default: 'Kontaktformulär' },
      { key: 'label_name', label: 'Fältetikett: Namn', default: 'Namn' },
      { key: 'label_email', label: 'Fältetikett: E-post', default: 'E-post' },
      { key: 'label_subject', label: 'Fältetikett: Ämne', default: 'Ämne' },
      { key: 'label_message', label: 'Fältetikett: Meddelande', default: 'Meddelande' },
      { key: 'submit', label: 'Knapptext', default: 'Skicka meddelande' },
      { key: 'success', label: 'Tack-meddelande', default: 'Tack! Ditt meddelande har skickats.', multiline: true },
    ],
  },
  {
    slug: 'press', label: 'Press', route: '/press', defaultTitle: 'Press', defaultIntro: 'Information och material för journalister och media.',
    manage: [
      { label: 'Hantera nyheter (pressmeddelanden)', to: '/admin/nyheter' },
      { label: 'Hantera dokument', to: '/admin/dokument' },
      { label: 'Hantera pressbilder (media)', to: '/admin/media' },
      { label: 'Hantera kontaktpersoner', to: '/admin/kontakter' },
    ],
    hasBlocks: true,
    fields: [
      { key: 'facts_heading', label: 'Rubrik: fakta', default: 'Fakta i korthet' },
      { key: 'facts', label: 'Fakta (en rad per punkt)', multiline: true, default: 'NCC planerar en ny bergtäkt i Rögleskogen mellan Södra Sandby och Dalby i Lunds kommun.\nProcessen befinner sig i informations- och samrådsskedet.\nEtt medborgarinitiativ har bildats för att samla information och frågor.\nAll information på denna webbplats är exempeldata om inte annat anges.' },
      { key: 'press_heading', label: 'Rubrik: pressmeddelanden', default: 'Aktuella pressmeddelanden' },
      { key: 'press_limit', label: 'Antal pressmeddelanden', type: 'number', default: '5', hint: 'Hämtas från de senast publicerade nyheterna.' },
      { key: 'press_empty', label: 'Pressmeddelanden: text när listan är tom', default: '', hint: 'Lämna tomt för att dölja hela rutan när inget är publicerat.' },
      { key: 'press_link', label: 'Länk till nyhetssidan', default: 'Alla nyheter →', hint: 'Visas under listan. Lämna tomt för att dölja länken.' },
      { key: 'docs_heading', label: 'Rubrik: nyckeldokument', default: 'Nyckeldokument' },
      { key: 'docs_limit', label: 'Antal nyckeldokument', type: 'number', default: '10' },
      { key: 'docs_empty', label: 'Nyckeldokument: text när listan är tom', default: '', hint: 'Lämna tomt för att dölja rutan.' },
      { key: 'docs_link', label: 'Länk till dokumentarkivet', default: 'Alla dokument →', hint: 'Visas under listan. Lämna tomt för att dölja länken.' },
      { key: 'contacts_heading', label: 'Rubrik: kontaktpersoner', default: 'Kontaktpersoner' },
      { key: 'contacts_empty', label: 'Kontaktpersoner: text när listan är tom', default: 'Kontaktuppgifter publiceras här.' },
      { key: 'images_heading', label: 'Rubrik: pressbilder', default: 'Pressbilder' },
      { key: 'images_note', label: 'Pressbilder: text under rubriken', multiline: true, default: '', hint: 'T.ex. villkor för användning. Visas bara om den är ifylld.' },
      { key: 'images_empty', label: 'Pressbilder: text när inga bilder är släppta', default: '', hint: 'Lämna tomt för att dölja rutan.' },
      { key: 'download_label', label: 'Länktext: ladda ner', default: 'Ladda ner →' },
      { key: 'updated_label', label: 'Rubrik: senast uppdaterad', default: 'Senast uppdaterad', hint: 'Lämna tomt för att dölja rutan.' },
      { key: 'updated_value', label: 'Senast uppdaterad: datum', default: '', hint: 'Fritext, t.ex. ”juli 2026”. Lämna tomt för dagens datum.' },
    ],
  },
]

export const pageBySlug = (slug: string) => PAGES.find(p => p.slug === slug)

// Toppnivå-adresser som egna sidor inte får använda (befintliga rutter + admin).
export const RESERVED_SLUGS = new Set([
  '', 'bakgrund', 'amnen', 'nyheter', 'vittnesmal', 'karta', 'tidslinje',
  'dokument', 'media', 'press', 'fragor-och-svar', 'kontakt',
  'admin', 'internt', 'login', 'api',
])

/** Gör en URL-vänlig slug av en titel (svenska tecken → ascii). */
export function slugify(input: string): string {
  return input
    .toLowerCase().trim()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Site pages that can be linked directly from the menu, with a suggested
// icon (Lucide name). Used by the menu editor to offer pages that are not
// yet in the menu, so the label + link don't have to be typed by hand.
export const MENU_PAGES: { label: string; url: string; icon: string }[] = [
  { label: 'Startsida', url: '/', icon: 'house' },
  { label: 'Bakgrund', url: '/bakgrund', icon: 'info' },
  { label: 'Ämnesområden', url: '/amnen', icon: 'layers' },
  { label: 'Nyheter', url: '/nyheter', icon: 'newspaper' },
  // Filtrerade vyer av nyhetssidan – går att lägga i menyn som egna poster.
  { label: 'Pressklipp', url: '/nyheter?kategori=pressklipp', icon: 'newspaper' },
  { label: 'Krönikor & debatt', url: '/nyheter?kategori=kronika', icon: 'quote' },
  { label: 'Pressmeddelanden', url: '/nyheter?kategori=pressmeddelande', icon: 'megaphone' },
  { label: 'Karta', url: '/karta', icon: 'map-pin' },
  { label: 'Tidslinje', url: '/tidslinje', icon: 'clock' },
  { label: 'Dokument', url: '/dokument', icon: 'file-text' },
  { label: 'Media', url: '/media', icon: 'image' },
  { label: 'Vittnesmål', url: '/vittnesmal', icon: 'message-circle' },
  { label: 'Frågor och svar', url: '/fragor-och-svar', icon: 'help-circle' },
  { label: 'Kontakt', url: '/kontakt', icon: 'mail' },
  { label: 'Press', url: '/press', icon: 'file-text' },
]
