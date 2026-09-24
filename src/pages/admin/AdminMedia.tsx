import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MediaItem, Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort, statusLabel, statusBadgeClass, mediaTypeLabel } from '../../lib/utils'
import Dropzone from '../../components/admin/Dropzone'

const PER_PAGE = 16 // 4x4

export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [testimonyImages, setTestimonyImages] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'media' | 'testimonies'>('media')
  const [tPage, setTPage] = useState(0)
  const [selectedT, setSelectedT] = useState<string | null>(null)
  const { user } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    Promise.all([
      supabase.from('media_items').select('*').order('updated_at', { ascending: false }),
      supabase.from('testimonies').select('*').order('created_at', { ascending: false }),
    ]).then(([m, t]) => {
      setItems(m.data as MediaItem[] ?? [])
      setTestimonyImages((t.data as Testimony[] ?? []).filter(x => x.featured_image && x.consent_marketing))
      setLoading(false)
    })
  }

  async function addUploaded(url: string, file: File) {
    const title = file.name.replace(/\.[^.]+$/, '')
    const { error } = await supabase.from('media_items').insert({
      title, media_type: 'image', file_url: url, status: 'draft', created_by: user?.id, updated_by: user?.id,
    })
    if (error) throw new Error(error.message)
  }

  async function remove(id: string) {
    if (!(await confirm({ message: 'Ta bort denna media?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('media_items').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Media borttagen', 'success'); load() }
  }

  const pageCount = Math.ceil(testimonyImages.length / PER_PAGE)
  const pageItems = testimonyImages.slice(tPage * PER_PAGE, tPage * PER_PAGE + PER_PAGE)
  const selected = testimonyImages.find(t => t.id === selectedT) ?? null

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Media</h1>
        {tab === 'media' && <Link to="/admin/media/ny" className="btn btn-ghost btn-sm">Lägg till manuellt</Link>}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'media'} className={tab === 'media' ? 'tab active' : 'tab'} onClick={() => setTab('media')}>Media</button>
        <button role="tab" aria-selected={tab === 'testimonies'} className={tab === 'testimonies' ? 'tab active' : 'tab'} onClick={() => { setTab('testimonies'); setSelectedT(null) }}>
          Vittnesbilder{testimonyImages.length ? ` (${testimonyImages.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : tab === 'media' ? (
        <>
          <Dropzone
            multiple
            label="Dra och släpp bilder här för att ladda upp"
            hint="eller klicka för att välja — de sparas som utkast"
            onUploaded={addUploaded}
            onComplete={() => { show('Bilder uppladdade', 'success'); load() }}
            onError={m => show('Uppladdning misslyckades: ' + m, 'error')}
          />
          {items.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 'var(--space-5)' }}><p>Inget media finns ännu.</p></div>
          ) : (
            <div className="media-grid">
              {items.map(m => (
                <div key={m.id} className="media-card">
                  <Link to={`/admin/media/${m.id}`} className="media-card-thumb">
                    {m.file_url ? <img src={m.file_url} alt={m.alt_text ?? m.title} loading="lazy" /> : <span className="media-card-placeholder" aria-hidden="true">{mediaTypeLabel(m.media_type)}</span>}
                    <span className={`media-card-status ${statusBadgeClass(m.status)}`}>{statusLabel(m.status)}</span>
                  </Link>
                  <div className="media-card-body">
                    <div className="media-card-title">{m.title}</div>
                    <div className="media-card-meta">{mediaTypeLabel(m.media_type)}{m.media_date ? ` · ${formatDateShort(m.media_date)}` : ''}</div>
                    <div className="media-card-actions">
                      <Link to={`/admin/media/${m.id}`} className="btn btn-secondary btn-xs">Redigera</Link>
                      <button className="btn btn-danger btn-xs" onClick={() => remove(m.id)}>Ta bort</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : testimonyImages.length === 0 ? (
        <div className="empty-state"><p>Inga vittnesmål med bild och marknadsförings­samtycke ännu.</p></div>
      ) : selected ? (
        <div className="vb-detail vb-detail-enter">
          <div className="vb-detail-info">
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSelectedT(null)}>← Tillbaka</button>
            <h2 style={{ margin: 0 }}>{selected.title || 'Vittnesmål'}</h2>
            <div className="admin-list-item-meta">
              <span className={statusBadgeClass(selected.status)}>{statusLabel(selected.status)}</span>
              <span>{selected.is_anonymous ? 'Anonym' : selected.author_name ?? 'Anonym'}</span>
              {selected.location && <span>{selected.location}</span>}
              <span>{formatDateShort(selected.created_at)}</span>
            </div>
            <p style={{ color: 'var(--text)' }}>{selected.story}</p>
            {selected.area_usage && <p className="text-muted" style={{ fontSize: '0.9rem' }}>Användning: {selected.area_usage}</p>}
            {selected.map_lat != null && selected.map_lng != null && (
              <a href={`/karta?vittnesmal=${selected.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                Visa punkten på kartan →
              </a>
            )}
          </div>
          <div className="vb-detail-image">
            <img src={selected.featured_image ?? ''} alt="" />
          </div>
        </div>
      ) : (
        <>
          <div className="vb-grid">
            {pageItems.map(t => (
              <button key={t.id} className="vb-cell" onClick={() => setSelectedT(t.id)} data-tooltip={t.title || 'Vittnesmål'} aria-label={t.title || 'Vittnesmål'}>
                <img src={t.featured_image ?? ''} alt="" loading="lazy" />
                {t.map_lat != null && <span className="vb-cell-pin" aria-hidden="true">📍</span>}
              </button>
            ))}
          </div>
          {pageCount > 1 && (
            <div className="vb-pagination">
              <button className="btn btn-secondary btn-sm" disabled={tPage === 0} onClick={() => setTPage(p => p - 1)}>← Föregående</button>
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>Sida {tPage + 1} av {pageCount}</span>
              <button className="btn btn-secondary btn-sm" disabled={tPage >= pageCount - 1} onClick={() => setTPage(p => p + 1)}>Nästa →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
