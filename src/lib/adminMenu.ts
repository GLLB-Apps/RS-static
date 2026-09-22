// Adminpanelens sidomeny och kommandopalettens "Skapa nytt"-genvägar, samlat
// på ett ställe så att båda (AdminLayout.tsx respektive CommandPalette.tsx)
// visar samma ikoner för samma sidor.
import {
  LayoutDashboard, FileEdit, FileText, FilePlus, Newspaper, BookOpen, FileStack, Image,
  MapPin, Hexagon, CalendarClock, HelpCircle, MessageSquareQuote, Mail, Contact, Handshake,
  PanelTop, PanelBottom, ListTree, Settings, Users, LayoutGrid, LifeBuoy, History,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from './types'
import type { NotificationSource } from './notifications'

export type MenuItem = { label: string; path: string; roles: UserRole[]; source?: NotificationSource; icon: LucideIcon }

// `source` kopplar menyposten till en notiskälla: den får en badge med antalet
// nya, och att öppna posten markerar just den källan som läst.
export const MENU_GROUPS: { title: string | null; items: MenuItem[] }[] = [
  {
    title: null,
    items: [
      { label: 'Översikt', path: '/admin', roles: ['superadmin', 'redaktor', 'skribent'], icon: LayoutDashboard },
      { label: 'Utkast', path: '/admin/utkast', roles: ['superadmin', 'redaktor', 'skribent'], source: 'drafts', icon: FileEdit },
    ],
  },
  {
    title: 'Innehåll',
    items: [
      { label: 'Sidor', path: '/admin/sidor', roles: ['superadmin', 'redaktor'], icon: FileText },
      { label: 'Fristående sidor', path: '/admin/egna-sidor', roles: ['superadmin', 'redaktor'], icon: FilePlus },
      { label: 'Nyheter', path: '/admin/nyheter', roles: ['superadmin', 'redaktor', 'skribent'], icon: Newspaper },
      { label: 'Ämnesområden', path: '/admin/amnen', roles: ['superadmin', 'redaktor', 'skribent'], icon: BookOpen },
      { label: 'Dokument', path: '/admin/dokument', roles: ['superadmin', 'redaktor', 'skribent'], icon: FileStack },
      { label: 'Media', path: '/admin/media', roles: ['superadmin', 'redaktor', 'skribent'], icon: Image },
      { label: 'Karta', path: '/admin/karta', roles: ['superadmin', 'redaktor'], icon: MapPin },
      { label: 'Tidslinje', path: '/admin/tidslinje', roles: ['superadmin', 'redaktor'], icon: CalendarClock },
      { label: 'FAQ', path: '/admin/faq', roles: ['superadmin', 'redaktor'], icon: HelpCircle },
    ],
  },
  {
    title: 'Kommunikation',
    items: [
      { label: 'Vittnesmål', path: '/admin/vittnesmal', roles: ['superadmin', 'redaktor'], source: 'testimonies', icon: MessageSquareQuote },
      { label: 'Meddelanden', path: '/admin/meddelanden', roles: ['superadmin', 'redaktor'], source: 'messages', icon: Mail },
      { label: 'Kontakter', path: '/admin/kontakter', roles: ['superadmin', 'redaktor'], icon: Contact },
      { label: 'Sponsorer', path: '/admin/sponsorer', roles: ['superadmin', 'redaktor'], icon: Handshake },
    ],
  },
  {
    title: 'Webbplats',
    items: [
      { label: 'Hero (startsida)', path: '/admin/hero', roles: ['superadmin', 'redaktor'], icon: PanelTop },
      { label: 'Sidfot', path: '/admin/sidfot', roles: ['superadmin', 'redaktor'], icon: PanelBottom },
      { label: 'Meny', path: '/admin/meny', roles: ['superadmin', 'redaktor'], icon: ListTree },
      { label: 'Inställningar', path: '/admin/inställningar', roles: ['superadmin'], icon: Settings },
      { label: 'Användare', path: '/admin/administratörer', roles: ['superadmin'], icon: Users },
    ],
  },
  {
    title: 'Internt',
    items: [
      { label: 'Internt arbetsrum', path: '/internt', roles: ['superadmin', 'redaktor', 'skribent'], icon: LayoutGrid },
    ],
  },
  {
    title: 'Hjälp',
    items: [
      { label: 'Handbok', path: '/admin/handbok', roles: ['superadmin', 'redaktor', 'skribent'], icon: LifeBuoy },
      { label: 'Ändringslogg', path: '/admin/andringslogg', roles: ['superadmin', 'redaktor', 'skribent'], icon: History },
    ],
  },
]

export interface CreateCommand {
  label: string
  path: string
  roles: UserRole[]
  icon: LucideIcon
}

/** Kommandopalettens "Skapa nytt" — hoppar rakt till varje innehållstyps eget nya-formulär. */
export const CREATE_COMMANDS: CreateCommand[] = [
  { label: 'Ny nyhet', path: '/admin/nyheter/ny', roles: ['superadmin', 'redaktor', 'skribent'], icon: Newspaper },
  { label: 'Nytt ämne', path: '/admin/amnen/ny', roles: ['superadmin', 'redaktor', 'skribent'], icon: BookOpen },
  { label: 'Nytt dokument', path: '/admin/dokument/ny', roles: ['superadmin', 'redaktor', 'skribent'], icon: FileStack },
  { label: 'Ny media', path: '/admin/media/ny', roles: ['superadmin', 'redaktor', 'skribent'], icon: Image },
  { label: 'Ny fristående sida', path: '/admin/egna-sidor/ny', roles: ['superadmin', 'redaktor'], icon: FilePlus },
  { label: 'Ny kartpunkt', path: '/admin/karta/ny', roles: ['superadmin', 'redaktor'], icon: MapPin },
  { label: 'Nytt kartområde', path: '/admin/karta/omrade/ny', roles: ['superadmin', 'redaktor'], icon: Hexagon },
  { label: 'Ny tidslinjehändelse', path: '/admin/tidslinje/ny', roles: ['superadmin', 'redaktor'], icon: CalendarClock },
]
