import { MonitorSmartphone } from 'lucide-react'

// Hard block on small screens across the admin area: the panel is built for
// larger screens, so on mobile it covers the UI entirely. CSS hides it on
// desktop; there is no way to dismiss it on mobile.
export default function MobileAdminNotice() {
  return (
    <div className="admin-mobile-notice" role="dialog" aria-modal="true">
      <div className="admin-mobile-notice-card">
        <span className="admin-mobile-notice-icon"><MonitorSmartphone size={40} aria-hidden="true" /></span>
        <h2>Öppna på dator</h2>
        <p>
          Adminpanelen är byggd för större skärmar och går inte att använda på
          mobil. Öppna webbplatsens admin på en dator för att logga in och
          hantera innehållet.
        </p>
        <a className="btn btn-secondary" href="/">Till webbplatsen</a>
      </div>
    </div>
  )
}
