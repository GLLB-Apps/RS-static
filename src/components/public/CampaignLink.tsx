import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Campaign } from '../../lib/campaign'
import MailConsentDialog from './MailConsentDialog'

// CTA-länken som följer kampanjläget. Externa mål (namninsamling, donation)
// öppnas i ny flik som förr; interna mål navigerar i appen i stället, så
// besökaren inte får en ny flik på egna webbplatsen. Är målet ett mejlutskick
// (samrådsläget) är knappen i stället en knapp: den öppnar en ruta som förklarar
// att nästa steg lämnar webbläsaren, och därifrån går mailto-länken vidare.
export default function CampaignLink({
  campaign, className, children, tabIndex,
}: {
  campaign: Campaign
  className?: string
  /** Utelämnas = knappens text från kampanjläget. */
  children?: ReactNode
  tabIndex?: number
}) {
  const [asking, setAsking] = useState(false)
  const label = children ?? campaign.ctaLabel

  if (campaign.mailTo) {
    return (
      <>
        <button
          type="button"
          className={className ? `campaign-cta ${className}` : 'campaign-cta'}
          onClick={() => setAsking(true)}
          tabIndex={tabIndex}
        >
          {label}
        </button>
        {asking && (
          <MailConsentDialog
            mailUrl={campaign.ctaUrl}
            address={campaign.mailTo}
            subject={campaign.mailSubject ?? ''}
            texts={campaign.mailDialog}
            onClose={() => setAsking(false)}
          />
        )}
      </>
    )
  }

  if (!campaign.external) {
    return <Link to={campaign.ctaUrl} className={className} tabIndex={tabIndex}>{label}</Link>
  }
  return (
    <a href={campaign.ctaUrl} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex}>
      {label}
    </a>
  )
}
