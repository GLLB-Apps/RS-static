import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapLocation, MapArea } from '../../lib/types'
import { mapPointTypeLabel, mapPointTypeIconName, distanceMeters, formatDistance, MAP_FIT_PADDING, areaBounds } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'

const COLORS: Record<string, string> = {
  work_area: '#b94a3d',
  quarry_area: '#b94a3d',
  property_border: '#4a6c7f',
  transport_route: '#b8860b',
  residence_distance: '#8b6f47',
  nature_value: '#3d7a52',
  walking_trail: '#2d5a3d',
  observation_point: '#4a6c7f',
  photo_point: '#8b6f47',
  testimony_point: '#2d5a3d',
}

interface Props {
  points: MapLocation[]
  /** Områdespolygoner som ska ritas. Redan filtrerade av anroparen. */
  areas?: MapArea[]
  height?: number
  /**
   * Id på en punkt att flyga till och öppna. Sätts om från punktväljaren; att
   * välja samma punkt igen ska zooma dit på nytt, vilket `focusNonce` löser.
   */
  focusId?: string | null
  focusNonce?: number
}

/** Zoomnivå när man hoppar till en enskild punkt ur väljaren. */
const FOCUS_ZOOM = 16

export default function MapPreview({ points, areas = [], height = 350, focusId = null, focusNonce = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  // Punkter och områden hålls i egna lagergrupper så att uppdatering av det ena
  // inte rensar bort det andra (L.Polygon ärver från L.Polyline).
  const pointLayerRef = useRef<L.LayerGroup | null>(null)
  const areaLayerRef = useRef<L.LayerGroup | null>(null)
  // Markörer per punkt-id, så att väljaren kan öppna rätt popup.
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  // Leaflet-markörer/popuper byggs som HTML-strängar. Vi renderar därför varje
  // ikon (React) i en gömd behållare och klonar dess <svg>-uppmärkning därifrån
  // — så slipper vi dra in react-dom/server bara för att göra strängar av dem.
  const iconStoreRef = useRef<HTMLDivElement>(null)
  const pointIcon = (p: MapLocation) => p.icon || mapPointTypeIconName(p.point_type)
  const iconNames = useMemo(() => Array.from(new Set(points.map(pointIcon))), [points])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: points[0] ? [points[0].lat, points[0].lng] : [55.72, 13.32],
      zoom: 13,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    mapRef.current = map
    areaLayerRef.current = L.layerGroup().addTo(map)
    pointLayerRef.current = L.layerGroup().addTo(map)

    // Utsnitt: visa samtliga områden vid start, oavsett vilka lager som är på.
    const fit = areaBounds(areas)
    if (fit.length) map.fitBounds(L.latLngBounds(fit), { padding: MAP_FIT_PADDING })

    return () => {
      map.remove()
      mapRef.current = null
      pointLayerRef.current = null
      areaLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const group = areaLayerRef.current
    if (!group) return
    group.clearLayers()

    areas.forEach(area => {
      if (area.points.length < 3) return
      L.polygon(area.points, {
        color: area.color,
        weight: 3,
        dashArray: area.line_style === 'dashed' ? '8 6' : undefined,
        opacity: 0.95,
        fillColor: area.color,
        fillOpacity: area.fill_opacity,
      })
        .bindTooltip(area.title, { sticky: true })
        .bindPopup(`
          ${area.image_url ? `<img src="${area.image_url}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : ''}
          <strong>${area.title}</strong>
          ${area.description ? `<br/><span style="font-size:0.85rem;">${area.description}</span>` : ''}
        `, { maxWidth: 240 })
        .addTo(group)
    })
  }, [areas])

  useEffect(() => {
    const map = mapRef.current
    const group = pointLayerRef.current
    if (!map || !group) return

    group.clearLayers()
    markersRef.current.clear()

    // Klonad <svg>-sträng för en ikon ur den gömda behållaren (färg ärvs via
    // currentColor från markören/popupen).
    const svgFor = (name: string) =>
      iconStoreRef.current?.querySelector(`[data-icon="${CSS.escape(name)}"] svg`)?.outerHTML ?? ''

    // Reference point(s) for "distance to residence": nearest quarry/work area.
    const quarryPoints = points.filter(p => p.point_type === 'quarry_area' || p.point_type === 'work_area')
    const nearestQuarry = (p: MapLocation) => {
      let best: MapLocation | null = null
      let bestDist = Infinity
      for (const q of quarryPoints) {
        const d = distanceMeters(p.lat, p.lng, q.lat, q.lng)
        if (d < bestDist) { bestDist = d; best = q }
      }
      return best ? { point: best, dist: bestDist } : null
    }

    points.forEach(point => {
      const color = COLORS[point.point_type] ?? '#2d5a3d'
      const iconName = pointIcon(point)
      const glyph = svgFor(iconName)
      const icon = L.divIcon({
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);display:flex;color:#fff;">${glyph}</span></div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 26],
        popupAnchor: [0, -24],
      })

      // Distance line from a residence point to the nearest planned quarry area.
      let distanceNote = ''
      if (point.point_type === 'residence_distance') {
        const nq = nearestQuarry(point)
        if (nq) {
          distanceNote = `<br/><strong style="font-size:0.85rem;color:#b94a3d;">≈ ${formatDistance(nq.dist)} till planerat täktområde</strong>`
          L.polyline([[point.lat, point.lng], [nq.point.lat, nq.point.lng]], {
            color: '#b94a3d', weight: 2, dashArray: '6 6', opacity: 0.75,
          })
            .addTo(group)
            .bindTooltip(`≈ ${formatDistance(nq.dist)} till planerat täktområde`, { sticky: true })
        }
      }

      const marker = L.marker([point.lat, point.lng], { icon }).addTo(group)
      markersRef.current.set(point.id, marker)
      marker.bindPopup(`
        ${point.image_url ? `<img src="${point.image_url}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};color:#fff;flex-shrink:0;">${svgFor(iconName)}</span>
          <strong>${point.title}</strong>
        </div>
        <span style="font-size:0.85rem;color:#666;">${mapPointTypeLabel(point.point_type)}</span>
        ${point.description ? `<br/><span style="font-size:0.85rem;">${point.description}</span>` : ''}
        ${distanceNote}
      `, { maxWidth: 240 })
    })
  }, [points])

  // Flyg till den valda punkten och öppna dess popup. Ligger efter effekten som
  // ritar markörerna, så att markören hunnit skapas när vi letar upp den.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusId) return
    const point = points.find(p => p.id === focusId)
    if (!point) return
    const marker = markersRef.current.get(focusId)
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.8 })
    // Popupen öppnas först när flygturen landat — öppnas den under tiden slåss
    // dess autopanorering med rörelsen. Timer och inte 'moveend', eftersom det
    // uteblir när kartan redan står på punkten.
    const timer = window.setTimeout(() => marker?.openPopup(), 850)
    return () => window.clearTimeout(timer)
  }, [focusId, focusNonce, points])

  return (
    <>
      <div ref={containerRef} style={{ height, borderRadius: 'var(--radius-lg)' }} />
      {/* Gömd ikonkälla som markörer/popuper klonar sin <svg> ifrån. */}
      <div ref={iconStoreRef} aria-hidden="true" style={{ display: 'none' }}>
        {iconNames.map(n => <span key={n} data-icon={n}><LucideIcon icon={n} size={16} /></span>)}
      </div>
    </>
  )
}
