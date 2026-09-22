import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { thinking } from 'blobatar/expression'
import { useAuth } from '../../lib/auth'
import { formatDate, usernameFromEmail } from '../../lib/utils'
import { findLatestDraft, clearDraft, type FoundDraft } from '../../lib/useAutosave'
import { DRAFT_ROUTE_FOR, DRAFT_KIND_LABEL, previewForDraft } from '../../lib/draftPreview'
import { ContentBlocks } from '../public/blocks'

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
  const { user, displayName } = useAuth()

  useEffect(() => {
    const draft = findLatestDraft()
    // Redan på rätt sida (t.ex. en omladdning mitt i redigeringen) — den
    // sidans egen AutosaveBanner visar redan samma utkast, så en global
    // dialog ovanpå den skulle bara dubblera frågan.
    if (draft && DRAFT_ROUTE_FOR[draft.kind]?.(draft.rest) === location.pathname) return
    setFound(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!found) return null

  const targetPath = DRAFT_ROUTE_FOR[found.kind]?.(found.rest)
  const welcomeName = displayName || (user?.email ? usernameFromEmail(user.email) : '')
  const preview = previewForDraft(found.kind, found.value)

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
      <div className="admin-modal draft-recovery-modal">
        <div className="draft-recovery-main">
          <div className="draft-recovery-greeting">
            <UserAvatar seed={user?.email ?? 'valkommen-tillbaka'} size={44} expression={thinking} title="Ett utkast väntar" />
            <strong>Välkommen tillbaka{welcomeName ? <>, {welcomeName}</> : ''}!</strong>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>
            Du har ett utkast som autosparades i webbläsaren {formatDate(found.savedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })},
            men som inte hann sparas på servern. Vill du fortsätta där du slutade?
          </p>
          <div className="autosave-banner-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={continueEditing}>Fortsätt där jag slutade</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>Nej tack</button>
          </div>
        </div>

        <div className="draft-recovery-preview">
          <span className="badge badge-muted">{DRAFT_KIND_LABEL[found.kind] ?? found.kind}</span>
          <h4>{preview.title.trim() || <span className="text-muted">Namnlös</span>}</h4>
          {preview.excerpt.trim() && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{preview.excerpt.trim()}</p>}
          <div className="draft-recovery-preview-blocks">
            {preview.blocks.length > 0
              ? <ContentBlocks blocks={preview.blocks} />
              : <p className="text-muted" style={{ fontSize: '0.85rem' }}>Inget innehåll skrivet än.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
