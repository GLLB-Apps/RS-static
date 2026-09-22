import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { blobatar } from 'blobatar'
import 'leaflet/dist/leaflet.css'
import type { Testimony, MapLocation, LatLngTuple } from '../../lib/types'
import { MAP_FIT_PADDING, testimonyBlobSeed } from '../../lib/utils'
import { useBlobAvatarsEnabled } from '../../lib/blobSettings'
import { hueForSeed, NATURE_SHAPES } from '../../lib/blobPalette'

/**
 * Markören som en cirkulär blob — samma figur som syns i listan, kortet,
 * den egna sidan och som personen själv mötte i formuläret (frö = namn +
 * berättelse, se testimonyBlobSeed i utils.ts — inte dokumentets id, det
 * skulle ge en annan figur än den man skickade in). `blobatar()` är
 * bibliotekets strängbaserade API, byggt för just det här: ren SVG-markup
 * utan React, för Leaflets egna DOM-baserade ikoner. Avstängt i
 * inställningarna faller den tillbaka på samma enfärgade prick som de
 * redaktionella referenspunkterna.
 */
function testimonyMarkerHtml(seed: string, size: number, enabled: boolean): string {
  if (!enabled) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#2d5a3d;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`
  }
  const svg = blobatar(seed, { background: 'circle', size, hue: hueForSeed(seed), traits: { shape: NATURE_SHAPES } })
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);overflow:hidden;">${svg}</div>`
}

interface Props {
  testimonies: Testimony[]
  /** Vittnesmålspunkter inlagda via admin. Visas tillsammans med vittnesmålen. */
  points?: MapLocation[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Punkter att rama in vid start — områdenas hörn, så att båda flikarna visar samma plats. */
  fitPoints?: LatLngTuple[]
  height?: number
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function popupHtml(t: Testimony, blobsEnabled: boolean) {
  const author = escapeHtml(t.is_anonymous ? 'Anonym' : (t.author_name || 'Anonym'))
  const img = t.featured_image ? `<img src="${t.featured_image}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : ''
  const title = t.title ? `<strong>${escapeHtml(t.title)}</strong><br/>` : ''
  const storyText = t.story.length > 160 ? t.story.slice(0, 160) + '…' : t.story
  const story = `<span style="font-size:0.85rem">${escapeHtml(storyText)}</span><br/>`
  const meta = escapeHtml(t.location ? `${author}, ${t.location}` : author)
  const avatar = testimonyMarkerHtml(testimonyBlobSeed(t.author_name ?? '', t.story, t.is_anonymous), 22, blobsEnabled)
  return `${img}${title}${story}` +
    `<span style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:#666">${avatar}${meta}</span><br/>` +
    `<a href="/vittnesmal/${t.id}" style="font-size:0.8rem">Läs hela vittnesmålet →</a>`
}

// Map that shows testimony markers (with popups: image + story). Clicking a
// marker (or selecting from the list) opens its popup and flies to it.
export default function TestimonyMap({ testimonies, points = [], selectedId, onSelect, fitPoints = [], height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const blobsEnabled = useBlobAvatarsEnabled()

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
    // Samma utsnitt som områdeskartan, så att de två flikarna visar samma plats.
    // Utan områden faller vi tillbaka på första vittnesmålet.
    const first = testimonies.find(t => t.map_lat != null && t.map_lng != null)
    if (fitPoints.length) map.fitBounds(L.latLngBounds(fitPoints), { padding: MAP_FIT_PADDING })
    else map.setView(first ? [first.map_lat as number, first.map_lng as number] : [55.70, 13.345], 13)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 60)
    return () => { map.remove(); mapRef.current = null; markersRef.current = {} }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    Object.values(markersRef.current).forEach(m => map.removeLayer(m))
    markersRef.current = {}
    testimonies.forEach(t => {
      if (t.map_lat == null || t.map_lng == null) return
      const icon = L.divIcon({
        html: testimonyMarkerHtml(testimonyBlobSeed(t.author_name ?? '', t.story, t.is_anonymous), 34, blobsEnabled),
        className: '', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
      })
      const marker = L.marker([t.map_lat, t.map_lng], { icon }).addTo(map)
      marker.bindPopup(popupHtml(t, blobsEnabled), { maxWidth: 240 })
      marker.on('click', () => onSelectRef.current(t.id))
      markersRef.current[t.id] = marker
    })

    // Redaktionella referenspunkter: en enfärgad prick utan figur, till
    // skillnad från vittnesmålens blobbar, så att de går att skilja åt.
    points.forEach(p => {
      const icon = L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#2d5a3d;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      })
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map)
      marker.bindPopup(
        `<strong>${escapeHtml(p.title)}</strong>` +
        (p.description ? `<br/><span style="font-size:0.85rem">${escapeHtml(p.description)}</span>` : ''),
        { maxWidth: 240 },
      )
      marker.on('click', () => onSelectRef.current(p.id))
      markersRef.current[p.id] = marker
    })
  }, [testimonies, points, blobsEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const marker = markersRef.current[selectedId]
    if (marker) { map.flyTo(marker.getLatLng(), 15, { duration: 0.6 }); marker.openPopup() }
  }, [selectedId])

  return <div ref={containerRef} className="testimony-map" style={{ height }} />
}
