import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import type { MapLocation, ContentStatus, MapPointType } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { mapPointTypeIconName } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'
import IconPicker from '../../components/admin/IconPicker'
import Dropzone from '../../components/admin/Dropzone'
import FocusModeToggle from '../../components/admin/FocusModeToggle'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function AdminMapEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const isNew = id === 'ny' || !id

  const [form, setForm] = useState({
    title: '', description: '', lat: 55.72, lng: 13.32,
    point_type: 'observation_point' as MapPointType, image_url: '', source: '',
  })
  const [icon, setIcon] = useState<string | null>(null)
  const [iconOpen, setIconOpen] = useState(false)
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (isNew) return
    supabase.from('map_locations').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        const p = data as MapLocation
        setForm({
          title: p.title, description: p.description ?? '', lat: p.lat, lng: p.lng,
          point_type: p.point_type, image_url: p.image_url ?? '', source: p.source ?? '',
        })
        setIcon(p.icon ?? null)
        setStatus(p.status)
      }
      setLoading(false)
    })
  }, [id, isNew])

  useEffect(() => {
    // Kartan skapas när containern finns, dvs. efter att laddningen är klar.
    if (loading || !mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [form.lat, form.lng],
      zoom: 14,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    mapRef.current = map

    markerRef.current = L.marker([form.lat, form.lng]).addTo(map)
    setTimeout(() => map.invalidateSize(), 60)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      setForm(prev => ({ ...prev, lat, lng }))
      markerRef.current?.setLatLng([lat, lng])
    })

    return () => { map.remove(); mapRef.current = null }
  }, [loading])

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLatLng([form.lat, form.lng])
  }, [form.lat, form.lng])

  function update(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(publish = false) {
    if (!form.title.trim()) { show('Titel krävs', 'error'); return }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    const payload = {
      title: form.title,
      description: form.description || null,
      lat: form.lat,
      lng: form.lng,
      point_type: form.point_type,
      icon: icon || null,
      image_url: form.image_url || null,
      source: form.source || null,
      status: saveStatus,
      updated_by: user?.id,
      published_at: publish ? new Date().toISOString() : null,
    }
    if (isNew) {
      const { error } = await supabase.from('map_locations').insert({ ...payload, created_by: user?.id })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { show('Kartpunkt skapad', 'success'); navigate('/admin/karta') }
    } else {
      const { error } = await supabase.from('map_locations').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show(publish ? 'Publicerad' : 'Sparat', 'success')
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>{isNew ? 'Ny kartpunkt' : 'Redigera kartpunkt'}{!isNew && form.title && <span className="admin-edit-subject"> — {form.title}</span>}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <FocusModeToggle />
          <Link to="/admin/karta" className="btn btn-ghost btn-sm">← Tillbaka</Link>
        </div>
      </div>
      <div className="map-edit-layout">
        <div className="map-edit-map admin-form-card">
          <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>Klicka på kartan för att placera punkten.</p>
          <div ref={mapContainerRef} style={{ height: 360, borderRadius: 'var(--radius-lg)' }} />
          <div className="grid grid-2" style={{ marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="lat">Latitud</label>
              <input id="lat" className="form-input" type="number" step="0.0001" value={form.lat} onChange={e => update('lat', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="lng">Longitud</label>
              <input id="lng" className="form-input" type="number" step="0.0001" value={form.lng} onChange={e => update('lng', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="map-edit-fields admin-form-card">
          <div className="form-group">
            <label className="form-label" htmlFor="title">Titel *</label>
            <input id="title" className="form-input" type="text" value={form.title} onChange={e => update('title', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">Beskrivning</label>
            <textarea id="description" className="form-textarea" rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="point_type">Typ</label>
            <select id="point_type" className="form-select" value={form.point_type} onChange={e => update('point_type', e.target.value)}>
              {Object.entries({
                work_area: 'Verksamhetsområde', quarry_area: 'Brytområde', property_border: 'Fastighetsgräns',
                transport_route: 'Transportväg', residence_distance: 'Avstånd till bostad',
                nature_value: 'Naturvärde', walking_trail: 'Promenadstråk',
                observation_point: 'Observationspunkt', photo_point: 'Fotopunkt', testimony_point: 'Vittnesmålspunkt',
              }).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ikon</label>
            <div className="map-icon-field">
              <button type="button" className="map-icon-current" onClick={() => setIconOpen(v => !v)} aria-expanded={iconOpen}>
                <LucideIcon icon={icon || mapPointTypeIconName(form.point_type)} size={20} />
                <span>{icon ?? 'Standard för typen'}</span>
              </button>
              {icon && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIcon(null)}>Återställ</button>}
            </div>
            {iconOpen && <IconPicker value={icon} onChange={n => { setIcon(n); setIconOpen(false) }} />}
            <p className="form-hint">Lämnas tom = punkttypens standardikon. Klistra in en Lucide-adress i sökrutan för valfri ikon.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Bild (valfritt)</label>
            {form.image_url ? (
              <div className="testimony-image-preview">
                <img src={form.image_url} alt="" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => update('image_url', '')}>Ta bort bild</button>
              </div>
            ) : (
              <Dropzone
                compact
                label="Dra och släpp en bild här"
                hint="eller klicka för att välja / ta ett foto"
                onUploaded={url => update('image_url', url)}
                onError={m => show('Uppladdning misslyckades: ' + m, 'error')}
              />
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="source">Källa</label>
            <input id="source" className="form-input" type="text" value={form.source} onChange={e => update('source', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="status">Status</label>
            <select id="status" className="form-select" value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
              <option value="draft">Utkast</option>
              <option value="published">Publicerad</option>
              <option value="archived">Arkiverad</option>
            </select>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>Publicera</button>
          </div>
        </div>
      </div>
    </div>
  )
}
