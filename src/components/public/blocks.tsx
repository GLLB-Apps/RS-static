import { Link } from 'react-router-dom'
import type { ContentBlock } from '../../lib/types'
import LucideIcon from '../../lib/lucide'
import { headingLevel, internalPath, normalizeUrl, splitParagraphs } from '../../lib/utils'

// Renders a single content block. Shared across pages that show free-form
// block content (background, press, …).
export function RenderBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': return <BlockHeading block={block} />
    case 'paragraph': return <p className="block-paragraph">{block.text}</p>
    case 'quote': return <BlockQuote block={block} />
    case 'list': return <BlockList block={block} />
    case 'cta': return <BlockCta block={block} />
    case 'factbox': return (
      <div className="block-factbox">
        {block.title && <h4>{block.title}</h4>}
        <p>{block.text}</p>
      </div>
    )
    case 'warning': return (
      <div className="block-warning">
        {block.title && <h4>{block.title}</h4>}
        <p>{block.text}</p>
      </div>
    )
    case 'image': return (
      <figure className="block-image">
        {block.image_url && <img src={block.image_url} alt={block.alt_text ?? ''} />}
        {block.text && <figcaption className="block-image-caption">{block.text}</figcaption>}
      </figure>
    )
    case 'video': return (
      <div className="block-video">
        {block.video_url && (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <iframe
              src={block.video_url}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={block.title ?? 'Video'}
            />
          </div>
        )}
      </div>
    )
    case 'divider': return <hr className="block-divider" />
    case 'button': return <BlockButton block={block} />
    case 'sources': return (
      <div className="block-sources">
        <h4>Källförteckning</h4>
        <ul>
          {block.sources?.map((s, i) => (
            <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
          ))}
        </ul>
      </div>
    )
    case 'links': return (
      <div className="block-sources">
        <h4>{block.title ?? 'Relaterade länkar'}</h4>
        <ul>
          {block.links?.map((l, i) => (
            <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>
          ))}
        </ul>
      </div>
    )
    case 'comparison': return (
      <div className="block-sources">
        {block.title && <h4>{block.title}</h4>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {block.rows?.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500 }}>{r.label}</td>
                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    case 'table': return <BlockTable block={block} />
    case 'resource': return <BlockResource block={block} />
    default: return null
  }
}

// Renders a list of content blocks inside a `.content-blocks` wrapper.
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks.length) return null
  return (
    <div className="content-blocks">
      {blocks.map((block, i) => <RenderBlock key={i} block={block} />)}
    </div>
  )
}

// Rubrik i vald nivå — h2 när inget valts, eftersom sidans titel redan är h1.
// Nivån styr både taggen (för skärmläsare och sökmotorer) och storleken.
// Ett citat kan vara flera stycken. En tom rad i texten delar av dem, precis som
// i markdown (och som Skift+Enter skriver in i editorn); en ensam radbrytning är
// mjuk radbrytning och rinner ihop som förr, så inklistrade radbrutna citat inte
// blir hackiga.
export function BlockQuote({ block }: { block: ContentBlock }) {
  const paragraphs = splitParagraphs(block.text)
  return (
    <blockquote className="block-quote">
      {paragraphs.length > 1
        ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
        : block.text}
    </blockquote>
  )
}

export function BlockHeading({ block }: { block: ContentBlock }) {
  const level = headingLevel(block.level)
  const Tag = `h${level}` as 'h1'
  return <Tag className={`block-heading block-heading-${level}`}>{block.text}</Tag>
}

// Tabell med valfritt antal kolumner — det PDF-importen gör av tabellerna i
// dokumentet. Breda tabeller scrollar i sidled i stället för att spränga sidan.
export function BlockTable({ block }: { block: ContentBlock }) {
  // Rubrikraden tas bort bara när den är helt tom — annars skulle en tabell med
  // en tom första kolumnrubrik få sina kolumner förskjutna.
  const columns = (block.columns ?? []).some(c => c.trim()) ? block.columns ?? [] : []
  const cells = (block.cells ?? []).filter(row => row.some(c => c.trim()))
  if (!columns.length && !cells.length) return null
  const width = Math.max(columns.length, ...cells.map(r => r.length), 0)
  const pad = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? '')
  return (
    <figure className="block-table-wrap">
      {block.title && <figcaption className="block-table-title">{block.title}</figcaption>}
      <div className="block-table-scroll">
        <table className="block-table">
          {columns.length > 0 && (
            <thead>
              <tr>{pad(columns).map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {cells.map((row, i) => (
              <tr key={i}>{pad(row).map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

// Bullet-list card block.
export function BlockList({ block }: { block: ContentBlock }) {
  const items = (block.items ?? []).filter(Boolean)
  if (!items.length && !block.title) return null
  return (
    <div className="block-list">
      {block.title && <h3 className="block-list-title">{block.title}</h3>}
      <ul className="block-list-items">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  )
}

// Knapp: en enda blocktyp för alla länkknappar. Adressen avgör beteendet — en
// sida på sajten navigeras utan omladdning, medan en extern adress (eller en
// uppladdad fil) öppnas i nytt fönster och märks med en ikon.
export function BlockButton({ block }: { block: ContentBlock }) {
  const href = normalizeUrl(block.url)
  if (!href) return null
  const label = block.text?.trim() || 'Öppna'
  const path = internalPath(block.url)
  if (path) return <Link to={path} className="block-button">{label}</Link>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block-button">
      {label}
      <LucideIcon icon="external-link" size={16} />
    </a>
  )
}

// External resource block: a uniform card for surveys, petitions, reports and
// other external forms — icon + title + description + a button, all opening in
// a new tab. Ersatt av knapp-blocket ovan; finns kvar för sidor som redan
// innehåller rutan.
export function BlockResource({ block }: { block: ContentBlock }) {
  if (!block.url && !block.title) return null
  const label = block.button_label?.trim() || 'Öppna'
  return (
    <div className="block-resource">
      <span className="block-resource-icon" aria-hidden="true"><LucideIcon icon="external-link" size={22} /></span>
      <div className="block-resource-body">
        {block.title && <h3 className="block-resource-title">{block.title}</h3>}
        {block.text && <p className="block-resource-text">{block.text}</p>}
        {block.url && (
          <div className="block-resource-action">
            <a href={block.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {label}
              <LucideIcon icon="external-link" size={16} />
            </a>
            <span className="block-resource-note">Öppnas i nytt fönster</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Call-to-action block: an optional heading + a row of buttons. Internal links
// (starting with "/") use client-side navigation; the rest open in a new tab.
export function BlockCta({ block }: { block: ContentBlock }) {
  const links = (block.links ?? []).filter(l => l.label && l.url)
  if (!links.length && !block.title) return null
  return (
    <div className="cta-section block-cta">
      {block.title && <h2>{block.title}</h2>}
      {links.length > 0 && (
        <div className="cta-actions">
          {links.map((l, i) => {
            const cls = i === 0 ? 'btn btn-primary' : 'btn btn-secondary'
            const path = internalPath(l.url)
            return path
              ? <Link key={i} to={path} className={cls}>{l.label}</Link>
              : <a key={i} href={normalizeUrl(l.url)} target="_blank" rel="noopener noreferrer" className={cls}>{l.label}</a>
          })}
        </div>
      )}
    </div>
  )
}
