import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { thinking } from 'blobatar/expression'
import { useAuth } from '../../lib/auth'
import { formatDate, usernameFromEmail, truncate, contentStats } from '../../lib/utils'
import { findLatestDraft, clearDraft, type FoundDraft } from '../../lib/useAutosave'
import type { ContentBlock } from '../../lib/types'

// Vilken redigerare (nyckelns "kind") som hör till vilken sida, och hur man
// bygger dess adress ur nyckelns "rest" (dokumentets id/slug, eller "new").
const ROUTE_FOR: Record<string, (rest: string) => string> = {
  topic: rest => `/admin/amnen/${rest === 'new' ? 'ny' : rest}`,
  news: rest => `/admin/nyheter/${rest === 'new' ? 'ny' : rest}`,
  page: rest => `/admin/sidor/${rest}`,
  'custom-page': rest => `/admin/egna-sidor/${rest === 'new' ? 'ny' : rest}`,
  background: () => '/admin/bakgrund',
}

const KIND_LABEL: Record<string, string> = {
  topic: 'Ämnesområde',
  news: 'Nyhet',
  page: 'Sida',
  'custom-page': 'Fristående sida',
  background: 'Bakgrund',
}

interface Preview {
  title: string
  excerpt: string
  blocks: ContentBlock[]
}

/** Utkastets form skiljer sig per redigerare (se t.ex. TopicDraft i AdminTopicEdit.tsx) — plockar ut det som är gemensamt att visa. */
function previewFor(kind: string, value: unknown): Preview {
  const v = (value ?? {}) as Record<string, unknown>
  switch (kind) {
    case 'topic':
    case 'page':
    case 'custom-page':
      return {
        title: typeof v.title === 'string' ? v.title : '',
        excerpt: typeof v.intro === 'string' ? v.intro : '',
        blocks: Array.isArray(v.content) ? v.content as ContentBlock[] : Array.isArray(v.blocks) ? v.blocks as ContentBlock[] : [],
      }
    case 'news': {
      const form = (v.form ?? {}) as Record<string, unknown>
      return {
        title: typeof form.title === 'string' ? form.title : '',
        excerpt: typeof form.excerpt === 'string' ? form.excerpt : '',
        blocks: Array.isArray(v.content) ? v.content as ContentBlock[] : [],
      }
    }
    case 'background':
      return { title: '', excerpt: '', blocks: Array.isArray(v.blocks) ? v.blocks as ContentBlock[] : [] }
    default:
      return { title: '', excerpt: '', blocks: [] }
  }
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
  const { user, displayName } = useAuth()

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
  const welcomeName = displayName || (user?.email ? usernameFromEmail(user.email) : '')
  const preview = previewFor(found.kind, found.value)
  const stats = contentStats(preview.blocks)

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
          <UserAvatar seed={user?.email ?? 'valkommen-tillbaka'} size={48} expression={thinking} title="Ett utkast väntar" />
          <div className="autosave-banner-text">
            <strong>Välkommen tillbaka{welcomeName ? <>, {welcomeName}</> : ''}!</strong>
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

        <div className="draft-recovery-preview">
          <span className="badge badge-muted">{KIND_LABEL[found.kind] ?? found.kind}</span>
          <h4>{preview.title.trim() || <span className="text-muted">Namnlös</span>}</h4>
          {preview.excerpt.trim() && <p className="text-muted">{truncate(preview.excerpt.trim(), 140)}</p>}
          <p className="form-hint" style={{ margin: 0 }}>
            {stats.words === 0
              ? 'Inget skrivet i innehållet än.'
              : `${stats.words} ord · ${stats.paragraphs} stycken · ~${stats.readingMinutes} min lästid`}
          </p>
        </div>
      </div>
    </div>
  )
}
