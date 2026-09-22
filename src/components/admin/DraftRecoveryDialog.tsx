import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { thinking } from 'blobatar/expression'
import { formatDate } from '../../lib/utils'
import { findLatestDraft, clearDraft, type FoundDraft } from '../../lib/useAutosave'

// Vilken redigerare (nyckelns "kind") som hör till vilken sida, och hur man
// bygger dess adress ur nyckelns "rest" (dokumentets id/slug, eller "new").
const ROUTE_FOR: Record<string, (rest: string) => string> = {
  topic: rest => `/admin/amnen/${rest === 'new' ? 'ny' : rest}`,
  news: rest => `/admin/nyheter/${rest === 'new' ? 'ny' : rest}`,
  page: rest => `/admin/sidor/${rest}`,
  'custom-page': rest => `/admin/egna-sidor/${rest === 'new' ? 'ny' : rest}`,
  background: () => '/admin/bakgrund',
}

/**
 * Global "Välkommen tillbaka"-dialog: visas direkt när adminpanelen öppnas
 * (en gång per inloggad session — se AdminLayout) om något av de fem
 * redigerarna har ett autosparat utkast som inte hann sparas på servern.
 * Man behöver alltså inte själv råka öppna rätt redigerare igen för att
 * hitta tillbaka — till skillnad från AutosaveBanner, som bara syns på just
 * den sidan utkastet hör till.
 */
export default function DraftRecoveryDialog() {
  const [found, setFound] = useState<FoundDraft | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const draft = findLatestDraft()
    // Redan på rätt sida (t.ex. en omladdning mitt i redigeringen) — den
    // sidans egen AutosaveBanner visar redan samma utkast, så en global
    // dialog ovanpå den skulle bara dubblera frågan.
    if (draft && ROUTE_FOR[draft.kind]?.(draft.rest) === location.pathname) return
    setFound(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!found) return null

  const targetPath = ROUTE_FOR[found.kind]?.(found.rest)

  function continueEditing() {
    setFound(null)
    // Redigeraren själv gör återställningen (den äger fälten/setters) — se
    // t.ex. AdminTopicEdit.tsx: flaggan tolkas där, efter att sidans egna
    // data hunnit laddas in, så utkastet inte skrivs över av den laddningen.
    if (targetPath) navigate(targetPath, { state: { autoRestoreDraft: true } })
  }

  function discard() {
    if (!found) return
    clearDraft(found.key)
    setFound(null)
  }

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal autosave-banner">
        <UserAvatar seed="valkommen-tillbaka" size={48} expression={thinking} title="Ett utkast väntar" />
        <div className="autosave-banner-text">
          <strong>Välkommen tillbaka!</strong>
          <p className="text-muted" style={{ margin: 0 }}>
            Du har ett utkast som autosparades i webbläsaren {formatDate(found.savedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })},
            men som inte hann sparas på servern. Vill du fortsätta där du slutade?
          </p>
        </div>
        <div className="autosave-banner-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={continueEditing}>Fortsätt där jag slutade</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>Nej tack</button>
        </div>
      </div>
    </div>
  )
}
