import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SiteSettings } from '../../lib/types'
import { useAuth } from '../../lib/auth'
import { getCampaign } from '../../lib/campaign'
import CampaignLink from './CampaignLink'
import {
  DEFAULT_FOOTER_LINKS, FOOTER_CTA_KEY, FOOTER_LINKS_KEY,
  fillFooterTokens, footerText, parseFooterLinks, serializeFooterLinks, useFooterTexts,
} from '../../lib/footer'

// Interna länkar renderas med <Link>, externa som vanliga <a>.
const isExternal = (url: string) => /^(https?:|mailto:|tel:)/i.test(url)

export default function Footer({ settings }: { settings: SiteSettings | null }) {
  const campaign = getCampaign(settings)
  const social = settings?.social_links ? Object.entries(settings.social_links) : []
  const texts = useFooterTexts()

  // Länken längst ned: admins → adminpanelen, medlemmar (utan admin) → intranätet,
  // utloggade → adminpanelens inloggning.
  const { isAdmin, isMember } = useAuth()
  const workspace = isAdmin
    ? { to: '/admin', label: 'Admin' }
    : isMember
      ? { to: '/internt', label: 'Internt' }
      : { to: '/admin', label: 'Admin' }

  // Static white outline of the logo as a decorative mark on the right.
  const [logoOutline, setLogoOutline] = useState('')
  useEffect(() => {
    let cancelled = false
    fetch('/site_logo/ncc_rs_logo.svg')
      .then(r => r.text())
      .then(t => { if (!cancelled) setLogoOutline(t.slice(Math.max(0, t.indexOf('<svg')))) })
      .catch(() => { /* decorative only */ })
    return () => { cancelled = true }
  }, [])

  // Sidfoten ligger under vikningen – att vänta in texterna är osynligt, och
  // slipper visa en text som redaktören just tagit bort.
  if (!texts) return null

  const siteName = settings?.site_name ?? 'Rögleskogen'
  const text = (key: string) => footerText(texts, key)
  const brandText = typeof texts.brand_text === 'string' ? texts.brand_text : (settings?.footer_text ?? text('brand_text'))
  const links = parseFooterLinks(texts[FOOTER_LINKS_KEY] ?? serializeFooterLinks(DEFAULT_FOOTER_LINKS))
  const showCtaLink = texts[FOOTER_CTA_KEY] !== '0'
  const copyright = fillFooterTokens(text('copyright'), siteName)
  const toTop = text('to_top')

  return (
    <footer className="site-footer">
      {/* Filled logo mark in the lighter footer body (not on the CTA band).
          It sits behind the content; any part reaching the CTA is hidden by the
          CTA's opaque background. */}
      {logoOutline && (
        <div className="footer-logo-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logoOutline }} />
      )}
      {/* Call to action band */}
      {campaign && (
        <div className="footer-cta">
          <div className="container footer-cta-inner">
            <div>
              <h3>{campaign.headline}</h3>
              <p>{campaign.blurb}</p>
            </div>
            <CampaignLink campaign={campaign} className="btn btn-primary">
              {campaign.ctaLabelLong}
            </CampaignLink>
          </div>
        </div>
      )}

      <div className="container footer-inner">
        <div className="footer-col footer-col-brand">
          <h3 className="footer-title">{siteName}</h3>
          <p className="footer-subtitle">{settings?.site_subtitle}</p>
          {brandText && <p className="footer-text">{brandText}</p>}
          {social.length > 0 && (
            <div className="footer-social">
              {social.map(([key, url]) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="footer-social-link">
                  {key}
                </a>
              ))}
            </div>
          )}
        </div>

        {(text('links_heading') || links.length > 0 || showCtaLink) && (
          <div className="footer-col">
            <h4 className="footer-heading">{text('links_heading')}</h4>
            <ul className="footer-links">
              {showCtaLink && campaign && (
                <li><CampaignLink campaign={campaign} /></li>
              )}
              {links.map((l, i) => (
                <li key={i}>
                  {isExternal(l.url)
                    ? <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                    : <Link to={l.url}>{l.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="footer-col">
          <h4 className="footer-heading">{text('contact_heading')}</h4>
          {settings?.contact_email && (
            <p className="footer-contact">
              <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
            </p>
          )}
          {settings?.contact_phone && <p className="footer-contact">{settings.contact_phone}</p>}
          {text('contact_note') && (
            <p className="footer-text" style={{ marginTop: 'var(--space-3)' }}>{text('contact_note')}</p>
          )}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          {copyright && <p className="footer-copyright">{copyright}</p>}
          <div className="footer-bottom-links">
            {toTop && (
              <button
                type="button"
                className="footer-to-top"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                {toTop}
              </button>
            )}
            <Link to={workspace.to} className="footer-admin-link">{workspace.label}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
