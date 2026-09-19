import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { SiteSettings, Topic, Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { firstContentImage, formatDate, formatDateShort, nextImportantDate, splitParagraphs, truncate } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'
import CountUp from '../../components/public/CountUp'
import VoteWidget from '../../components/public/VoteWidget'
import SponsorTicker from '../../components/public/SponsorTicker'
import RogleTeaser from '../../components/public/RogleTeaser'
import { usePage } from '../../lib/usePage'
import { getCampaign } from '../../lib/campaign'
import CampaignLink from '../../components/public/CampaignLink'

export default function HomePage() {
  const { settings } = useOutletContext<{ settings: SiteSettings | null }>()
  const page = usePage('hem')
  const [topics, setTopics] = useState<Topic[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const summaryRef = useRef<HTMLElement>(null)
  const heroBgRef = useRef<HTMLDivElement>(null)
  const [showWidget, setShowWidget] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('topics').select('*').eq('status', 'published').order('sort_order').limit(6),
      supabase.from('posts').select('*').eq('status', 'published').order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(3),
    ]).then(([t, p]) => {
      setTopics(t.data as Topic[] ?? [])
      setPosts(p.data as Post[] ?? [])
      setLoading(false)
    })
  }, [])

  // Reveal the floating widget once the summary section reaches the top; then it
  // follows. Also drives a subtle parallax on the hero image (rAF-throttled).
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const update = () => {
      raf = 0
      const el = summaryRef.current
      if (el) setShowWidget(el.getBoundingClientRect().top <= 120)
      if (!reduce && heroBgRef.current) {
        const y = Math.min(window.scrollY * 0.35, 140)
        heroBgRef.current.style.transform = `translate3d(0, ${y}px, 0) scale(1.5)`
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [loading])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const campaign = getCampaign(settings)
  // Väljs ur listan av viktiga datum vid varje rendering: det första som inte
  // passerat. Så byter rutan av sig själv när dagen infaller, utan att någon
  // behöver gå in i admin.
  const nextDate = nextImportantDate(settings)

  return (
    <div className="fade-in">
      {showWidget && <VoteWidget settings={settings} />}
      {/* Hero / översikt */}
      <section className="hero">
        {settings?.hero_image && (
          <div ref={heroBgRef} className="hero-bg" style={{ backgroundImage: `url(${settings.hero_image})` }} />
        )}
        <div className="hero-content">
          <h1>{settings?.hero_title ?? 'Ett nytt stenbrott planeras i Rögleskogen'}</h1>
          {(() => {
            const paragraphs = splitParagraphs(settings?.hero_intro)
            return paragraphs.length > 1
              ? <div className="hero-intro">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
              : <p className="hero-intro">{settings?.hero_intro}</p>
          })()}
          <div className="hero-actions">
            {(settings?.hero_buttons?.length ? settings.hero_buttons : null)
              ? settings!.hero_buttons.map((b, i) => {
                  const cls = `btn btn-${b.style === 'primary' ? 'primary' : 'secondary'}`
                  if (b.cta) return campaign ? <CampaignLink key={i} campaign={campaign} className={cls} /> : null
                  if (!b.label) return null
                  return b.url.startsWith('/')
                    ? <Link key={i} to={b.url} className={cls}>{b.label}</Link>
                    : <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className={cls}>{b.label}</a>
                })
              : (
                <>
                  <Link to="/amnen" className="btn btn-primary">Läs om planerna</Link>
                  {campaign && <CampaignLink campaign={campaign} className="btn btn-secondary" />}
                  <Link to="/karta" className="btn btn-secondary">Se området på karta</Link>
                </>
              )}
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="section status-highlight">
        <div className="container">
          <div className="section-header">
            <h2>{page.text('status_heading')}</h2>
            <p>{page.text('status_intro')}</p>
          </div>
          <div className="status-card">
            <div className="status-item">
              <span className="status-label">Aktuell fas</span>
              <span className="status-value">{settings?.status_phase ?? 'Informations- och samrådsskedet'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Nästa viktiga datum</span>
              <span className="status-value">{nextDate ? formatDate(nextDate.date) : 'Ännu ej fastställt'}</span>
              {nextDate?.label && <span className="status-note">{nextDate.label}</span>}
            </div>
            <div className="status-item">
              <span className="status-label">Senast uppdaterad</span>
              <span className="status-value">{formatDate(new Date().toISOString())}</span>
            </div>
            {campaign?.showSignatures ? (
              <>
                <div className="status-item">
                  <span className="status-label">Underskrifter</span>
                  <span className="status-value status-value-count"><CountUp value={settings?.signature_count ?? 0} /></span>
                </div>
                <div className="status-item">
                  <span className="status-label">Namninsamling</span>
                  <a href={campaign.ctaUrl} target="_blank" rel="noopener noreferrer" className="status-value status-value-link">
                    Skrivunder.com →
                  </a>
                </div>
              </>
            ) : campaign ? (
              <div className="status-item">
                <span className="status-label">{campaign.headline}</span>
                <CampaignLink campaign={campaign} className="status-value status-value-link">
                  {campaign.ctaLabel} →
                </CampaignLink>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Sammanfattning */}
      <section ref={summaryRef} className="section" style={{ background: 'var(--bg-alt)' }}>
        <div className="container">
          <div className="section-header">
            <h2>{page.text('summary_heading')}</h2>
          </div>
          <div className="grid grid-3">
            <div className="card">
              <h3>{page.text('card1_title')}</h3>
              <p className="text-muted">{page.text('card1_text')}</p>
            </div>
            <div className="card">
              <h3>{page.text('card2_title')}</h3>
              <p className="text-muted">{page.text('card2_text')}</p>
            </div>
            <div className="card">
              <h3>{page.text('card3_title')}</h3>
              <p className="text-muted">{page.text('card3_text')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ämnesområden */}
      {topics.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2>{page.text('topics_heading')}</h2>
              <p>{page.text('topics_intro')}</p>
            </div>
            <div className="grid grid-3">
              {topics.map(topic => (
                <Link key={topic.id} to={`/amnen/${topic.slug}`} className="card card-clickable topic-card">
                  <div className="topic-card-icon">
                    {topic.featured_image ? (
                      <img src={topic.featured_image} alt="" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                    ) : (
                      <LucideIcon icon={topic.icon} className="topic-icon-svg" />
                    )}
                  </div>
                  <h3>{topic.title}</h3>
                  {topic.intro && <p>{truncate(topic.intro, 100)}</p>}
                </Link>
              ))}
            </div>
            <Link to="/amnen" className="section-link">Alla ämnen →</Link>
          </div>
        </section>
      )}

      {/* Senaste nytt */}
      {posts.length > 0 && (
        <section className="section" style={{ background: 'var(--bg-alt)' }}>
          <div className="container">
            <div className="section-header">
              <h2>{page.text('news_heading')}</h2>
            </div>
            <div className="grid grid-3">
              {posts.map(post => {
                const image = post.featured_image ?? firstContentImage(post.content)
                return (
                  <Link key={post.id} to={`/nyheter/${post.slug}`} className="card card-clickable news-card">
                    {image && (
                      <img src={image} alt="" className="news-card-image" />
                    )}
                    <span className="news-card-date">{formatDateShort(post.published_at)}</span>
                    <h3>{post.title}</h3>
                    {post.excerpt && <p>{truncate(post.excerpt, 120)}</p>}
                  </Link>
                )
              })}
            </div>
            <Link to="/nyheter" className="section-link">Fler nyheter →</Link>
          </div>
        </section>
      )}

      {/* Sponsorer (ticker) ovanför CTA */}
      <SponsorTicker />

      {/* Hjälp till / CTA */}
      <section className="section">
        <div className="container">
          <div className="cta-section">
            <h2>{page.text('cta_heading')}</h2>
            <p className="text-muted">{page.text('cta_text')}</p>
            <RogleTeaser />
            {campaign && (
              <div className="cta-actions">
                <CampaignLink campaign={campaign} className="btn btn-primary" />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
