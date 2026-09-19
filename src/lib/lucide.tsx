// Central Lucide icon module. Everywhere the system lets you pick an icon
// (menus, topics and other content), the value stored is a Lucide icon name
// in kebab-case (e.g. "map-pin"). <LucideIcon icon="map-pin" /> renders it.
//
// The registry below is a curated, searchable subset of the Lucide library so
// the picker stays fast and the bundle small (named imports are tree-shaken).
// LEGACY maps the old hand-drawn icon keys onto Lucide names so existing menu
// and topic data keeps rendering.
import type { LucideProps } from 'lucide-react'
import type { ComponentType } from 'react'
import { icons as LUCIDE_ICONS } from 'lucide-react'
import {
  House, Info, Newspaper, Layers, Map as MapIcon, MapPin, Clock, FileText, Image, MessageCircle,
  HelpCircle, Mail, Phone, AtSign, Users, User, Megaphone, Bell, Search, Calendar, CalendarDays,
  Leaf, TreePine, Trees, Sprout, Flower, Flower2, Droplet, Droplets, Waves, Wind, Sun, Cloud,
  CloudRain, Mountain, MountainSnow, Fish, Bird, Bug, Recycle, Globe,
  Factory, Hammer, Construction, TrafficCone, Truck, Car, Bus, Bike, Footprints, Route,
  Navigation, Compass, Ruler, Landmark,
  HeartPulse, Activity, Shield, ShieldCheck, AlertTriangle, Volume2,
  Files, Folder, FolderOpen, FileCheck, Download, Upload, ExternalLink, Camera, Video, Link,
  Bookmark, Tag, Quote, List, BookOpen, PenTool, Scale, Gavel,
  Handshake, Heart, ThumbsUp, Eye, Star, Flag, Lightbulb, Zap,
} from 'lucide-react'

export interface IconDef {
  name: string
  label: string
  group: string
  keywords: string
  Icon: ComponentType<LucideProps>
}

// group | name (kebab) | label | Icon | keywords (sv + en, space separated)
const R = (group: string, name: string, label: string, Icon: ComponentType<LucideProps>, keywords: string): IconDef =>
  ({ group, name, label, Icon, keywords })

export const ICON_LIBRARY: IconDef[] = [
  // Navigering & sidor
  R('Navigering', 'house', 'Hem', House, 'home start hus förstasida'),
  R('Navigering', 'info', 'Info', Info, 'information om'),
  R('Navigering', 'newspaper', 'Nyheter', Newspaper, 'news press tidning artiklar'),
  R('Navigering', 'layers', 'Ämnen', Layers, 'topics lager ämnesområden'),
  R('Navigering', 'map', 'Karta', MapIcon, 'map karta'),
  R('Navigering', 'map-pin', 'Plats', MapPin, 'location plats punkt nål'),
  R('Navigering', 'clock', 'Tid', Clock, 'time tid klocka tidslinje'),
  R('Navigering', 'file-text', 'Dokument', FileText, 'document dokument fil'),
  R('Navigering', 'image', 'Media', Image, 'media bild foto'),
  R('Navigering', 'message-circle', 'Vittnesmål', MessageCircle, 'chat vittnesmål berättelse prat'),
  R('Navigering', 'help-circle', 'FAQ', HelpCircle, 'question frågor svar hjälp'),
  R('Navigering', 'mail', 'Kontakt', Mail, 'contact e-post mejl brev'),
  R('Navigering', 'phone', 'Telefon', Phone, 'phone telefon ring'),
  R('Navigering', 'at-sign', 'E-post', AtSign, 'email at snabel-a'),
  R('Navigering', 'users', 'Personer', Users, 'people personer grupp'),
  R('Navigering', 'user', 'Person', User, 'person profil'),
  R('Navigering', 'megaphone', 'Ropa ut', Megaphone, 'megafon bullhorn sprid kampanj'),
  R('Navigering', 'bell', 'Notis', Bell, 'bell notis klocka'),
  R('Navigering', 'search', 'Sök', Search, 'search sök förstora'),
  R('Navigering', 'calendar', 'Kalender', Calendar, 'calendar kalender datum'),
  R('Navigering', 'calendar-days', 'Datum', CalendarDays, 'calendar datum dag'),

  // Natur & miljö
  R('Natur & miljö', 'leaf', 'Löv', Leaf, 'nature natur löv växt grön'),
  R('Natur & miljö', 'tree-pine', 'Barrträd', TreePine, 'tree träd skog gran tall'),
  R('Natur & miljö', 'trees', 'Skog', Trees, 'trees skog träd'),
  R('Natur & miljö', 'sprout', 'Grodd', Sprout, 'sprout planta grodd växt'),
  R('Natur & miljö', 'flower', 'Blomma', Flower, 'flower blomma'),
  R('Natur & miljö', 'flower-2', 'Blomma 2', Flower2, 'flower blomma'),
  R('Natur & miljö', 'droplet', 'Droppe', Droplet, 'water vatten droppe'),
  R('Natur & miljö', 'droplets', 'Vatten', Droplets, 'water vatten droppar grundvatten'),
  R('Natur & miljö', 'waves', 'Vågor', Waves, 'waves vågor vatten hav sjö'),
  R('Natur & miljö', 'wind', 'Vind', Wind, 'wind vind luft damm'),
  R('Natur & miljö', 'sun', 'Sol', Sun, 'sun sol väder'),
  R('Natur & miljö', 'cloud', 'Moln', Cloud, 'cloud moln väder'),
  R('Natur & miljö', 'cloud-rain', 'Regn', CloudRain, 'rain regn väder'),
  R('Natur & miljö', 'mountain', 'Berg', Mountain, 'mountain berg landskap täkt'),
  R('Natur & miljö', 'mountain-snow', 'Bergstopp', MountainSnow, 'mountain berg snö'),
  R('Natur & miljö', 'fish', 'Fisk', Fish, 'fish fisk djur vatten'),
  R('Natur & miljö', 'bird', 'Fågel', Bird, 'bird fågel djur'),
  R('Natur & miljö', 'bug', 'Insekt', Bug, 'bug insekt djur'),
  R('Natur & miljö', 'recycle', 'Återvinning', Recycle, 'recycle återvinning miljö'),
  R('Natur & miljö', 'globe', 'Jordglob', Globe, 'globe jord värld miljö'),

  // Täkt, industri & trafik
  R('Täkt & trafik', 'factory', 'Fabrik', Factory, 'factory fabrik industri'),
  R('Täkt & trafik', 'hammer', 'Hammare', Hammer, 'hammer hammare arbete'),
  R('Täkt & trafik', 'construction', 'Bygge', Construction, 'construction bygge arbete täkt'),
  R('Täkt & trafik', 'traffic-cone', 'Trafikkon', TrafficCone, 'cone kon trafik arbete'),
  R('Täkt & trafik', 'truck', 'Lastbil', Truck, 'truck lastbil transport'),
  R('Täkt & trafik', 'car', 'Bil', Car, 'car bil trafik'),
  R('Täkt & trafik', 'bus', 'Buss', Bus, 'bus buss kollektiv'),
  R('Täkt & trafik', 'bike', 'Cykel', Bike, 'bike cykel'),
  R('Täkt & trafik', 'footprints', 'Fotspår', Footprints, 'walk gång fotspår stig'),
  R('Täkt & trafik', 'route', 'Rutt', Route, 'route rutt väg transport'),
  R('Täkt & trafik', 'navigation', 'Navigering', Navigation, 'navigation riktning'),
  R('Täkt & trafik', 'compass', 'Kompass', Compass, 'compass kompass riktning'),
  R('Täkt & trafik', 'ruler', 'Mått', Ruler, 'ruler mått avstånd'),
  R('Täkt & trafik', 'landmark', 'Myndighet', Landmark, 'landmark myndighet kommun institution'),

  // Hälsa & säkerhet
  R('Hälsa & säkerhet', 'heart-pulse', 'Hälsa', HeartPulse, 'health hälsa puls'),
  R('Hälsa & säkerhet', 'activity', 'Aktivitet', Activity, 'activity puls mätning'),
  R('Hälsa & säkerhet', 'shield', 'Skydd', Shield, 'shield skydd säkerhet'),
  R('Hälsa & säkerhet', 'shield-check', 'Skyddat', ShieldCheck, 'shield skydd godkänd säker'),
  R('Hälsa & säkerhet', 'alert-triangle', 'Varning', AlertTriangle, 'warning varning fara'),
  R('Hälsa & säkerhet', 'volume-2', 'Ljud', Volume2, 'sound ljud buller volym'),

  // Dokument & media
  R('Dokument & media', 'files', 'Filer', Files, 'files filer dokument'),
  R('Dokument & media', 'folder', 'Mapp', Folder, 'folder mapp'),
  R('Dokument & media', 'folder-open', 'Öppen mapp', FolderOpen, 'folder mapp öppen'),
  R('Dokument & media', 'file-check', 'Godkänt dokument', FileCheck, 'file dokument klar godkänd'),
  R('Dokument & media', 'download', 'Ladda ner', Download, 'download ladda ner'),
  R('Dokument & media', 'upload', 'Ladda upp', Upload, 'upload ladda upp'),
  R('Dokument & media', 'external-link', 'Extern länk', ExternalLink, 'link länk extern'),
  R('Dokument & media', 'camera', 'Kamera', Camera, 'camera kamera foto'),
  R('Dokument & media', 'video', 'Video', Video, 'video film'),
  R('Dokument & media', 'link', 'Länk', Link, 'link länk'),
  R('Dokument & media', 'bookmark', 'Bokmärke', Bookmark, 'bookmark bokmärke'),
  R('Dokument & media', 'tag', 'Etikett', Tag, 'tag etikett tagg'),
  R('Dokument & media', 'quote', 'Citat', Quote, 'quote citat'),
  R('Dokument & media', 'list', 'Lista', List, 'list lista punkter'),
  R('Dokument & media', 'book-open', 'Bok', BookOpen, 'book bok läs'),
  R('Dokument & media', 'pen-tool', 'Penna', PenTool, 'pen penna skriv'),
  R('Dokument & media', 'scale', 'Våg', Scale, 'scale våg rättvisa juridik'),
  R('Dokument & media', 'gavel', 'Klubba', Gavel, 'gavel klubba juridik beslut'),

  // Engagemang
  R('Engagemang', 'handshake', 'Samarbete', Handshake, 'handshake samarbete hälsa'),
  R('Engagemang', 'heart', 'Hjärta', Heart, 'heart hjärta stöd'),
  R('Engagemang', 'thumbs-up', 'Gilla', ThumbsUp, 'thumbs gilla stöd'),
  R('Engagemang', 'eye', 'Öga', Eye, 'eye öga visa bevaka'),
  R('Engagemang', 'star', 'Stjärna', Star, 'star stjärna favorit'),
  R('Engagemang', 'flag', 'Flagga', Flag, 'flag flagga markera'),
  R('Engagemang', 'lightbulb', 'Idé', Lightbulb, 'idea idé lampa'),
  R('Engagemang', 'zap', 'Blixt', Zap, 'zap blixt energi'),
]

const byName = new Map(ICON_LIBRARY.map(d => [d.name, d]))

// Old hand-drawn icon keys (MenuIcon / TopicIcon) → Lucide names.
const LEGACY: Record<string, string> = {
  home: 'house', news: 'newspaper', document: 'file-text', chat: 'message-circle',
  question: 'help-circle', image: 'image', mail: 'mail', users: 'users', leaf: 'leaf',
  flag: 'flag', star: 'star', link: 'link', info: 'info', layers: 'layers', clock: 'clock',
  sound: 'volume-2', water: 'droplets', tree: 'tree-pine', wind: 'wind', mountain: 'mountain',
  truck: 'truck', health: 'heart-pulse', shield: 'shield', map: 'map-pin',
}

// kebab-case Lucide name → PascalCase component key, e.g. "map-pin" → "MapPin",
// "flower-2" → "Flower2".
function toPascal(name: string): string {
  return name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())
}

// Cheap shape check for a Lucide icon name — rejects empty/garbage before we
// bother looking a value up in the full set.
const NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

// The full Lucide set, keyed by PascalCase component name. It is already in the
// main bundle (several components import named icons statically, and this map
// pulls the rest), so importing it here is synchronous and free — which lets
// LucideIcon render any icon, including ones pasted from lucide.dev that aren't
// in the curated registry above, without a lazy/Suspense round-trip.
const FULL = LUCIDE_ICONS as Record<string, ComponentType<LucideProps>>
function fullSetComponent(name: string): ComponentType<LucideProps> | undefined {
  return NAME_RE.test(name) ? FULL[toPascal(name)] : undefined
}

// Easter egg: pull an icon name out of a lucide.dev icon URL pasted into a
// picker, e.g. "https://lucide.dev/icons/anchor" → "anchor". null if not one.
export function parseLucideUrl(input: string): string | null {
  const m = input.trim().match(/lucide\.dev\/icons\/([a-z0-9-]+)/i)
  return m ? m[1].toLowerCase() : null
}

// Whether `name` is a real Lucide icon (registry names included).
export function isLucideIconName(name: string): boolean {
  return byName.has(name) || !!fullSetComponent(name)
}

export function resolveIconName(value?: string | null): string | null {
  if (!value) return null
  if (byName.has(value)) return value
  const alias = LEGACY[value]
  if (alias && byName.has(alias)) return alias
  // Icons pasted from lucide.dev aren't in the curated registry but are still
  // valid Lucide names — accept anything shaped like one so callers that gate
  // on this (e.g. the menu) still render it via the full-set fallback below.
  if (NAME_RE.test(value)) return value
  return null
}

export default function LucideIcon({ icon, ...rest }: { icon?: string | null } & LucideProps) {
  if (!icon) return null
  // Curated registry first (tree-shaken, canonical), then the full set for
  // anything pasted from lucide.dev. Unknown names render nothing.
  const Cmp = byName.get(resolveIconName(icon) ?? '')?.Icon ?? fullSetComponent(icon)
  return Cmp ? <Cmp aria-hidden="true" {...rest} /> : null
}
