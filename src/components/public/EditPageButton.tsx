import { Link, useLocation } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { PAGES } from '../../lib/pages'
import { useEditLinkContext } from '../../lib/editLink'

// Default edit target for a public page: its primary dynamic-content manager
// (e.g. "Hantera ämnen"), falling back to the "Sidor" hub for pure text pages.
// Startsidan pekar på sin textredigerare i stället för på hero-editorn: det är
// där rubrikerna, statusrutan och de tre blocken under sammanfattningen ligger,
// och därifrån länkar sidopanelen vidare till hero och inställningar.
function targetForPath(pathname: string): string | null {
  const cfg = PAGES.find(p => p.route === pathname)
  if (!cfg) return null
  if (cfg.route === '/') return '/admin/sidor/hem'
  return cfg.manage[0]?.to ?? `/admin/sidor/${cfg.slug}`
}

// Floating "edit this page" button, shown to logged-in admins on desktop.
export default function EditPageButton() {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const { override } = useEditLinkContext()

  if (!isAdmin) return null
  const to = override ?? targetForPath(pathname)
  if (!to) return null

  return (
    <Link to={to} className="edit-page-fab" title="Redigera denna sida" aria-label="Redigera denna sida">
      <Pencil size={26} aria-hidden="true" />
      <span className="edit-page-fab-label">Redigera sidan</span>
    </Link>
  )
}
