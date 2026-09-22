import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import type { MapArea, ContentStatus, MapAreaLineStyle, LatLngTuple } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { parseCoordinateText, polygonAreaKm2, MAP_FIT_PADDING } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'
import IconPicker from '../../components/admin/IconPicker'
import Dropzone from '../../components/admin/Dropzone'
import FocusModeToggle from '../../components/admin/FocusModeToggle'
import { useFocusMode } from '../../lib/focusMode'
import { FADE } from '../../lib/motionPresets'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Färger ur webbplatsens palett. Egen färg går att välja med färgväljaren.
const PRESET_COLORS = [
  { value: '#b94a3d', label: 'Röd' },
  { value: '#7d2e24', label: 'Mörkröd' },
  { value: '#4a6c7f', label: 'Blå' },
  { value: '#3d7a52', label: 'Grön' },
  { value: '#b8860b', label: 'Ockra' },
]

const coordsToText = (pts: LatLngTuple[]) => pts.map(([lat, lng]) => `${lat}, ${lng}`).join('\n')

export default function AdminMapAreaEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const { focusMode } = useFocusMode()
  const isNew = id === 'ny' || !id

  const [form, setForm] = useState({
    title: '', description: '', color: '#b94a3d',
    line_style: 'solid' as MapAreaLineStyle, fill_opacity: 0.1, sort_order: 0, image_url: '',
  })
  const [points, setPoints] = useState<LatLngTuple[]>([])
  const [history, setHistory] = useState<LatLngTuple[][]>([])
  const [icon, setIcon] = useState<string | null>(null)
  const [iconOpen, setIconOpen] = useState(false)
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  // Nya områden ritas oftast från grunden, befintliga justeras genom att dra hörn.
  const [addMode, setAddMode] = useState(isNew)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteErrors, setPasteErrors] = useState<string[]>([])

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const shapeRef = useRef<L.LayerGroup | null>(null)
  // Refs så att kartans klick-handler alltid ser aktuellt läge utan att bindas om.
  const pointsRef = useRef(points)
  pointsRef.current = points
  const addModeRef = useRef(addMode)
  addModeRef.current = addMode
  const didFitRef = useRef(false)

  /** Sparar nuvarande hörn i ångra-historiken innan de ändras. */
  function commit(next: LatLngTuple[]) {
    setHistory(h => [...h.slice(-49), pointsRef.current])
    setPoints(next)
  }

  function undo() {
    setHistory(h => {
      if (h.length === 0) return h
      setPoints(h[h.length - 1])
      return h.slice(0, -1)
    })
  }

  useEffect(() => {
    if (isNew) return
    supabase.from('map_areas').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        const a = data as MapArea
        setForm({
          title: a.title, description: a.description ?? '', color: a.color || '#b94a3d',
          line_style: a.line_style || 'solid', fill_opacity: a.fill_opacity ?? 0.1,
          sort_order: a.sort_order ?? 0, image_url: a.image_url ?? '',
        })
        setPoints(Array.isArray(a.points) ? a.points : [])
        setIcon(a.icon ?? null)
        setStatus(a.status)
      }
      setLoading(false)
    })
  }, [id, isNew])

  // Karta skapas en gång, när containern finns (dvs. efter att laddningen är klar).
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, { center: [55.70, 13.345], zoom: 14 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    shapeRef.current = L.layerGroup().addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!addModeRef.current) return
      commit([...pointsRef.current, [e.latlng.lat, e.latlng.lng]])
    })
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 60)
    return () => { map.remove(); mapRef.current = null; shapeRef.current = null }
  }, [loading])

  // Ritar om polygonen och hörnmarkörerna när punkterna ändras.
  useEffect(() => {
    const map = mapRef.current
    const group = shapeRef.current
    if (!map || !group) return
    group.clearLayers()

    if (points.length >= 2) {
      const shape = points.length >= 3
        ? L.polygon(points, {
            color: form.color, weight: 3, opacity: 0.95,
            dashArray: form.line_style === 'dashed' ? '8 6' : undefined,
            fillColor: form.color, fillOpacity: form.fill_opacity,
          })
        : L.polyline(points, { color: form.color, weight: 3 })
      shape.addTo(group)
    }

    points.forEach((p, i) => {
      const marker = L.marker(p, {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: `<div class="map-vertex">${i + 1}</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11],
        }),
      })
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        const next = [...pointsRef.current]
        next[i] = [ll.lat, ll.lng]
        commit(next)
      })
      // Klick på ett hörn tar bort det.
      marker.on('click', ev => {
        L.DomEvent.stopPropagation(ev)
        commit(pointsRef.current.filter((_, j) => j !== i))
      })
      marker.bindTooltip(`Hörn ${i + 1} — klicka för att ta bort`, { direction: 'top' })
      marker.addTo(group)
    })

    // Rama in befintligt område en gång, när det laddats.
    if (!didFitRef.current && points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: MAP_FIT_PADDING })
      didFitRef.current = true
    }
  }, [points, form.color, form.line_style, form.fill_opacity])

  function update(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function applyPaste(mode: 'replace' | 'append') {
    const { points: parsed, errors } = parseCoordinateText(pasteText)
    setPasteErrors(errors)
    if (parsed.length === 0) { show('Inga koordinater kunde tolkas', 'error'); return }
    commit(mode === 'replace' ? parsed : [...points, ...parsed])
    didFitRef.current = false
    show(`${parsed.length} hörn ${mode === 'replace' ? 'inlästa' : 'tillagda'}`, 'success')
  }

  function openPaste() {
    setPasteText(coordsToText(points))
    setPasteErrors([])
    setPasteOpen(true)
  }

  async function save(publish = false) {
    if (!form.title.trim()) { show('Titel krävs', 'error'); return }
    if (points.length < 3) { show('Ett område behöver minst 3 hörn', 'error'); return }
    setSaving(true)
    const saveStatus = publish ? 'published' : status
    const payload = {
      title: form.title,
      description: form.description || null,
      color: form.color,
      line_style: form.line_style,
      fill_opacity: form.fill_opacity,
      sort_order: form.sort_order,
      icon: icon || null,
      image_url: form.image_url || null,
      points,
      status: saveStatus,
      updated_by: user?.id,
      published_at: publish ? new Date().toISOString() : null,
    }
    if (isNew) {
      const { error } = await supabase.from('map_areas').insert({ ...payload, created_by: user?.id })
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { show('Område skapat', 'success'); navigate('/admin/karta') }
    } else {
      const { error } = await supabase.from('map_areas').update(payload).eq('id', id)
      setSaving(false)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else { setStatus(saveStatus as ContentStatus); show(publish ? 'Publicerad' : 'Sparat', 'success') }
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <AnimatePresence initial={false}>
          {!focusMode && (
            <motion.h1 key="title" {...FADE}>
              {isNew ? 'Nytt område' : 'Redigera område'}{!isNew && form.title && <span className="admin-edit-subject"> — {form.title}</span>}
            </motion.h1>
          )}
        </AnimatePresence>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <FocusModeToggle />
          <AnimatePresence initial={false}>
            {!focusMode && (
              <motion.div key="back" {...FADE}>
                <Link to="/admin/karta" className="btn btn-ghost btn-sm">← Tillbaka</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="map-edit-layout">
        <div className="map-edit-map admin-form-card">
        <div className="map-editor-toolbar">
          <button
            type="button"
            className={addMode ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={() => setAddMode(v => !v)}
            aria-pressed={addMode}
          >
            {addMode ? '✓ Lägger till hörn' : 'Lägg till hörn'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={undo} disabled={history.length === 0}>
            Ångra
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openPaste}>
            Koordinater…
          </button>
          <span className="map-editor-stat">
            {points.length} hörn
            {points.length >= 3 && <> · ≈ {polygonAreaKm2(points).toFixed(2)} km²</>}
          </span>
        </div>

        <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>
          {addMode
            ? 'Klicka på kartan för att lägga till ett hörn. Dra ett hörn för att flytta det, klicka på det för att ta bort det.'
            : 'Dra ett hörn för att flytta det, klicka på det för att ta bort det. Slå på "Lägg till hörn" för att rita nya.'}
        </p>

        {points.length > 0 && points.length < 3 && (
          <p className="form-hint form-hint-warning">Ett område behöver minst 3 hörn för att kunna sparas.</p>
        )}

        <div ref={mapContainerRef} style={{ height: 420, marginBottom: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }} />

        {pasteOpen && (
          <div className="map-paste-panel">
            <label className="form-label" htmlFor="paste">Koordinater — en per rad, <code>latitud, longitud</code></label>
            <p className="form-hint">
              Samma format som när du kopierar en punkt i Google Maps. Upprepa inte första punkten sist — området sluts automatiskt.
            </p>
            <textarea
              id="paste"
              className="form-textarea"
              rows={8}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'55.703935, 13.333008\n55.704762, 13.340586\n…'}
            />
            {pasteErrors.length > 0 && (
              <ul className="map-paste-errors">
                {pasteErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <div className="admin-form-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => applyPaste('replace')}>Ersätt hörn</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPaste('append')}>Lägg till sist</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPasteOpen(false)}>Stäng</button>
            </div>
          </div>
        )}
        </div>

        <div className="map-edit-fields admin-form-card">
        <div className="form-group">
          <label className="form-label" htmlFor="title">Titel *</label>
          <input id="title" className="form-input" type="text" value={form.title} onChange={e => update('title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="description">Beskrivning</label>
          <textarea id="description" className="form-textarea" rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
          <p className="form-hint">Visas i popupen när någon klickar på området.</p>
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
          <p className="form-hint">Visas i popupen när någon klickar på området.</p>
        </div>

        <div className="form-group">
          <label className="form-label">Ikon</label>
          <div className="map-icon-field">
            <button type="button" className="map-icon-current" onClick={() => setIconOpen(v => !v)} aria-expanded={iconOpen}>
              {icon ? <LucideIcon icon={icon} size={20} /> : <span className="map-icon-none" aria-hidden="true">◦</span>}
              <span>{icon ?? 'Ingen ikon'}</span>
            </button>
            {icon && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIcon(null)}>Ta bort</button>}
          </div>
          {iconOpen && <IconPicker value={icon} onChange={n => { setIcon(n); setIconOpen(false) }} />}
          <p className="form-hint">Visas i teckenförklaringen. Klistra in en Lucide-adress i sökrutan för valfri ikon.</p>
        </div>

        <div className="form-group">
          <label className="form-label">Färg</label>
          <div className="map-color-row">
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                className={form.color === c.value ? 'map-color-chip is-active' : 'map-color-chip'}
                style={{ background: c.value }}
                onClick={() => update('color', c.value)}
                aria-label={c.label}
                aria-pressed={form.color === c.value}
                title={c.label}
              />
            ))}
            <input
              className="map-color-custom"
              type="color"
              value={form.color}
              onChange={e => update('color', e.target.value)}
              aria-label="Egen färg"
            />
          </div>
        </div>

        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="line_style">Linjestil</label>
            <select id="line_style" className="form-select" value={form.line_style} onChange={e => update('line_style', e.target.value)}>
              <option value="solid">Heldragen</option>
              <option value="dashed">Streckad</option>
            </select>
            <p className="form-hint">Använd streckad för att skilja två områden med liknande färg.</p>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fill_opacity">Fyllning: {Math.round(form.fill_opacity * 100)} %</label>
            <input
              id="fill_opacity"
              className="form-input"
              type="range"
              min="0" max="0.6" step="0.01"
              value={form.fill_opacity}
              onChange={e => update('fill_opacity', Number(e.target.value))}
            />
            <p className="form-hint">Låg fyllning gör att kartunderlaget syns igenom.</p>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="sort_order">Sorteringsordning</label>
            <input id="sort_order" className="form-input" type="number" value={form.sort_order} onChange={e => update('sort_order', Number(e.target.value))} />
            <p className="form-hint">Lägre tal visas först i teckenförklaringen.</p>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="status">Status</label>
            <select id="status" className="form-select" value={status} onChange={e => setStatus(e.target.value as ContentStatus)}>
              <option value="draft">Utkast</option>
              <option value="published">Publicerad</option>
              <option value="archived">Arkiverad</option>
            </select>
          </div>
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
