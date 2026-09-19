import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/public/PageHeader'
import type { MapLocation, MapArea, Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import MapPreview from '../../components/public/MapPreview'
import TestimonyMap from '../../components/public/TestimonyMap'
import { mapPointTypeLabel, mapPointTypeIconName, areaBounds } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'
import { usePage } from '../../lib/usePage'

export default function MapPage() {
  const [points, setPoints] = useState<MapLocation[]>([])
  const [areas, setAreas] = useState<MapArea[]>([])
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set())
  const [hiddenAreas, setHiddenAreas] = useState<Set<string>>(new Set())
  // Ihopfällbara kategorier i teckenförklaringen ("Områden" / "Punkter").
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'area' | 'testimonies'>('area')
  // Punkten som väljaren senast hoppade till. Räknaren gör att samma val två
  // gånger i rad zoomar dit igen i stället för att inte hända någonting.
  const [focusId, setFocusId] = useState<string | null>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const [selectedT, setSelectedT] = useState<string | null>(null)
  const page = usePage('karta')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    Promise.all([
      supabase.from('map_locations').select('*').eq('status', 'published'),
      supabase.from('map_areas').select('*').eq('status', 'published').order('sort_order'),
      supabase.from('testimonies').select('*').eq('status', 'approved').order('published_at', { ascending: false }),
    ]).then(([p, a, t]) => {
      setPoints(p.data as MapLocation[] ?? [])
      setAreas((a.data as MapArea[] ?? []).filter(x => Array.isArray(x.points) && x.points.length >= 3))
      setTestimonies((t.data as Testimony[] ?? []).filter(x => x.map_lat != null && x.map_lng != null))
      setLoading(false)
    })
  }, [])

  // Deep link: /karta?vittnesmal=<id> opens the testimony tab and selects it.
  useEffect(() => {
    const id = searchParams.get('vittnesmal')
    if (id) { setTab('testimonies'); setSelectedT(id) }
  }, [searchParams])

  // Vittnesmålspunkter som lagts in via admin hör hemma i vittnesmålsfliken,
  // inte bland områdeslagren. Övriga punkttyper ligger kvar under "Området".
  const testimonyPoints = useMemo(() => points.filter(p => p.point_type === 'testimony_point'), [points])
  const areaPoints = useMemo(() => points.filter(p => p.point_type !== 'testimony_point'), [points])

  // Memoiseras: listan skickas vidare till kartan, som ritar om markörerna och
  // skulle flyga om till en vald punkt varje gång referensen bytte.
  const filteredPoints = useMemo(
    () => activeTypes.size === 0 ? areaPoints : areaPoints.filter(p => activeTypes.has(p.point_type)),
    [areaPoints, activeTypes],
  )

  // useMemo hindrar att polygonerna ritas om vid varje render.
  const visibleAreas = useMemo(() => areas.filter(a => !hiddenAreas.has(a.id)), [areas, hiddenAreas])
  const fitPoints = useMemo(() => areaBounds(areas), [areas])

  function toggleArea(id: string) {
    setHiddenAreas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleType(type: string) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const uniqueTypes = Array.from(new Set(areaPoints.map(p => p.point_type)))

  // Väljarens innehåll följer kartan: bara punkter som faktiskt syns, grupperade
  // per punkttyp och i bokstavsordning inom gruppen.
  const jumpGroups = useMemo(() => {
    const map = new Map<string, MapLocation[]>()
    for (const p of filteredPoints) {
      if (!map.has(p.point_type)) map.set(p.point_type, [])
      map.get(p.point_type)!.push(p)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.title.localeCompare(b.title, 'sv'))
    return Array.from(map.entries())
  }, [filteredPoints])

  // Släcks lagret som den valda punkten låg i försvinner den ur väljaren också.
  const focusValue = filteredPoints.some(p => p.id === focusId) ? (focusId ?? '') : ''

  function jumpTo(id: string) {
    setFocusId(id || null)
    setFocusNonce(n => n + 1)
  }

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader slug="karta" />
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'area'} className={tab === 'area' ? 'tab active' : 'tab'} onClick={() => setTab('area')}>Området</button>
        <button role="tab" aria-selected={tab === 'testimonies'} className={tab === 'testimonies' ? 'tab active' : 'tab'} onClick={() => setTab('testimonies')}>
          Vittnesmål{testimonies.length + testimonyPoints.length ? ` (${testimonies.length + testimonyPoints.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : tab === 'area' ? (
        areas.length === 0 && areaPoints.length === 0 ? (
          <div className="empty-state"><p>Inget kartinnehåll har publicerats ännu.</p></div>
        ) : (
          <div className="map-layout map-layout-left fade-in">
            <aside className="map-filters">
              <h2 className="map-filters-title">{page.text('layers_heading')}</h2>
              <p className="map-filters-hint">{page.text('layers_hint')}</p>

              {jumpGroups.length > 0 && (
                <div className="map-jump">
                  <label className="map-jump-label" htmlFor="map-jump">Hoppa till punkt</label>
                  <select
                    id="map-jump"
                    className="form-select map-jump-select"
                    value={focusValue}
                    onChange={e => jumpTo(e.target.value)}
                  >
                    <option value="">Välj en punkt…</option>
                    {jumpGroups.map(([type, pts]) => (
                      <optgroup key={type} label={mapPointTypeLabel(type)}>
                        {pts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {areas.length > 0 && (
                <div className="map-filter-group">
                  <button
                    type="button"
                    className="map-filter-group-head"
                    onClick={() => toggleCollapse('areas')}
                    aria-expanded={!collapsed.has('areas')}
                  >
                    <span className="map-filter-group-chevron" aria-hidden="true">{collapsed.has('areas') ? '▸' : '▾'}</span>
                    <span className="map-filter-group-title">Områden</span>
                    <span className="map-filter-count">{areas.length}</span>
                  </button>
                  {!collapsed.has('areas') && (
                    <div className="map-filter-group-body">
                      {areas.map(area => {
                        const active = !hiddenAreas.has(area.id)
                        return (
                          <button
                            key={area.id}
                            className={active ? 'map-filter' : 'map-filter is-off'}
                            onClick={() => toggleArea(area.id)}
                            aria-pressed={active}
                          >
                            <span
                              className="map-area-swatch"
                              style={{ borderColor: area.color, borderStyle: area.line_style === 'dashed' ? 'dashed' : 'solid' }}
                              aria-hidden="true"
                            />
                            {area.icon && <LucideIcon icon={area.icon} size={15} className="map-filter-area-icon" />}
                            <span className="map-filter-label">{area.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {uniqueTypes.length > 0 && (
                <div className="map-filter-group">
                  <button
                    type="button"
                    className="map-filter-group-head"
                    onClick={() => toggleCollapse('points')}
                    aria-expanded={!collapsed.has('points')}
                  >
                    <span className="map-filter-group-chevron" aria-hidden="true">{collapsed.has('points') ? '▸' : '▾'}</span>
                    <span className="map-filter-group-title">Punkter</span>
                    <span className="map-filter-count">{areaPoints.length}</span>
                  </button>
                  {!collapsed.has('points') && (
                    <div className="map-filter-group-body">
                      {uniqueTypes.map(type => {
                        const active = activeTypes.size === 0 || activeTypes.has(type)
                        const count = areaPoints.filter(p => p.point_type === type).length
                        return (
                          <button key={type} className={active ? 'map-filter' : 'map-filter is-off'} onClick={() => toggleType(type)} aria-pressed={active}>
                            <span className="map-filter-icon" aria-hidden="true"><LucideIcon icon={mapPointTypeIconName(type)} size={15} /></span>
                            <span className="map-filter-label">{mapPointTypeLabel(type)}</span>
                            <span className="map-filter-count">{count}</span>
                          </button>
                        )
                      })}
                      {activeTypes.size > 0 && (
                        <button className="map-filter-reset" onClick={() => setActiveTypes(new Set())}>Visa alla punkter</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </aside>
            <div className="map-container">
              <MapPreview points={filteredPoints} areas={visibleAreas} height={520} focusId={focusId} focusNonce={focusNonce} />
            </div>
          </div>
        )
      ) : (
        testimonies.length === 0 && testimonyPoints.length === 0 ? (
          <div className="empty-state"><p>Inga vittnesmål med markerad plats ännu.</p></div>
        ) : (
          <div className="testimony-map-layout fade-in">
            <aside className="testimony-list">
              {testimonyPoints.map(p => (
                <button
                  key={p.id}
                  className={selectedT === p.id ? 'testimony-list-item is-active' : 'testimony-list-item'}
                  onClick={() => setSelectedT(p.id)}
                >
                  {p.image_url && <img src={p.image_url} alt="" className="testimony-list-thumb" />}
                  <span className="testimony-list-body">
                    <span className="testimony-list-title">{p.title}</span>
                    {p.description && (
                      <span className="testimony-list-snippet">
                        {p.description.length > 90 ? p.description.slice(0, 90) + '…' : p.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {testimonies.map(t => (
                <button
                  key={t.id}
                  className={selectedT === t.id ? 'testimony-list-item is-active' : 'testimony-list-item'}
                  onClick={() => setSelectedT(t.id)}
                >
                  {t.featured_image && <img src={t.featured_image} alt="" className="testimony-list-thumb" />}
                  <span className="testimony-list-body">
                    <span className="testimony-list-title">{t.title || (t.is_anonymous ? 'Anonym' : t.author_name || 'Vittnesmål')}</span>
                    <span className="testimony-list-snippet">{t.story.length > 90 ? t.story.slice(0, 90) + '…' : t.story}</span>
                    {t.location && <span className="testimony-list-loc">{t.location}</span>}
                  </span>
                </button>
              ))}
            </aside>
            <div className="testimony-map">
              <TestimonyMap testimonies={testimonies} points={testimonyPoints} selectedId={selectedT} onSelect={setSelectedT} fitPoints={fitPoints} height={520} />
            </div>
          </div>
        )
      )}
    </div>
  )
}
