import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  lat: number | null
  lng: number | null
  onChange?: (lat: number, lng: number) => void
  height?: number
  readOnly?: boolean
}

// Small Leaflet map: click to place/move a marker (interactive) or just show a
// saved position (readOnly). Used in the testimony form and the CMS.
export default function MapPicker({ lat, lng, onChange, height = 300, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat ?? 55.7285, lng ?? 13.321],
      zoom: lat != null ? 15 : 13,
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
    if (!readOnly) {
      map.on('click', (e: L.LeafletMouseEvent) => onChangeRef.current?.(e.latlng.lat, e.latlng.lng))
    }
    mapRef.current = map
    // The map is often mounted inside a just-revealed container.
    setTimeout(() => map.invalidateSize(), 60)
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (lat != null && lng != null) {
      const icon = L.divIcon({
        html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#b94a3d;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
        className: '', iconSize: [18, 18], iconAnchor: [9, 18],
      })
      if (!markerRef.current) markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
      else markerRef.current.setLatLng([lat, lng])
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }
  }, [lat, lng])

  return <div ref={containerRef} className="map-picker" style={{ height }} />
}
