import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAIL_DIALOG_DEFAULTS, type MailDialogTexts } from '../../lib/campaign'

// Mellanlandning innan besökarens mejlprogram öppnas. Poängen är att ingen ska
// bli överraskad av att ett fönster hoppar upp utanför webbläsaren, och att det
// framgår att mejlet skrivs och skickas av besökaren själv — vi varken läser
// eller förmedlar det. Texterna redigeras i webbplatsinställningar; utelämnas de
// används standardtexterna (MAIL_DIALOG_DEFAULTS i lib/campaign).
export default function MailConsentDialog({ mailUrl, address, subject, texts, onClose }: {
  mailUrl: string
  address: string
  subject: string
  texts?: MailDialogTexts | null
  onClose: () => void
}) {
  const t = texts ?? MAIL_DIALOG_DEFAULTS
  const confirmRef = useRef<HTMLAnchorElement>(null)
  const [copied, setCopied] = useState(false)

  // Esc stänger, och fokus börjar på knappen som för vidare.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    confirmRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Sidan bakom ska inte gå att rulla medan rutan ligger över.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Utan klippbordsrättighet får adressen markeras för hand – den står ju där.
    }
  }

  return createPortal(
    <div className="mail-consent-backdrop" onClick={onClose}>
      <div
        className="mail-consent"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-consent-title"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="mail-consent-close" onClick={onClose} aria-label="Stäng">✕</button>

        <div className="mail-consent-badge" aria-hidden="true">@</div>
        <h2 id="mail-consent-title" className="mail-consent-title">{t.title}</h2>

        <p className="mail-consent-text">{t.text}</p>

        <dl className="mail-consent-facts">
          <div>
            <dt>Till</dt>
            <dd>
              <span className="mail-consent-address">{address}</span>
              <button type="button" className="mail-consent-copy" onClick={copyAddress}>
                {copied ? 'Kopierad ✓' : 'Kopiera'}
              </button>
            </dd>
          </div>
          <div>
            <dt>Ämne</dt>
            <dd>{subject}</dd>
          </div>
        </dl>

        <div className="mail-consent-actions">
          {/* Stängs strax efter klicket, inte i det: rycks länken ur DOM:en
              medan klicket behandlas avbryter vissa webbläsare mailto-öppningen. */}
          <a
            ref={confirmRef}
            href={mailUrl}
            className="btn btn-primary"
            onClick={() => window.setTimeout(onClose, 300)}
          >
            {t.confirm}
          </a>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
        </div>

        <p className="mail-consent-note">{t.note}</p>
      </div>
    </div>,
    document.body,
  )
}
