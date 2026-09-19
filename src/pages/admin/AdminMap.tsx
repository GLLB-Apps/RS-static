import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MapLocation, MapArea } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { mapPointTypeLabel, mapPointTypeIconName, statusLabel, statusBadgeClass, polygonAreaKm2 } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'

type Tab = 'points' | 'areas'

export default function AdminMap() {
  const [tab, setTab] = useState<Tab>('areas')
  const [points, setPoints] = useState<MapLocation[]>([])
  const [areas, setAreas] = useState<MapArea[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    Promise.all([
      supabase.from('map_locations').select('*').order('updated_at', { ascending: false }),
      supabase.from('map_areas').select('*').order('sort_order'),
    ]).then(([p, a]) => {
      setPoints(p.data as MapLocation[] ?? [])
      setAreas(a.data as MapArea[] ?? [])
      setLoading(false)
    })
  }

  async function removePoint(id: string) {
    if (!(await confirm({ message: 'Ta bort denna kartpunkt?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('map_locations').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Kartpunkt borttagen', 'success'); load() }
  }

  async function removeArea(id: string, title: string) {
    if (!(await confirm({ message: `Ta bort området "${title}"? Gränsen försvinner från kartan.`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('map_areas').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Område borttaget', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Karta</h1>
        {tab === 'areas'
          ? <Link to="/admin/karta/omrade/ny" className="btn btn-primary btn-sm">Nytt område</Link>
          : <Link to="/admin/karta/ny" className="btn btn-primary btn-sm">Ny kartpunkt</Link>}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'areas'} className={tab === 'areas' ? 'tab active' : 'tab'} onClick={() => setTab('areas')}>
          Polygoner{areas.length ? ` (${areas.length})` : ''}
        </button>
        <button role="tab" aria-selected={tab === 'points'} className={tab === 'points' ? 'tab active' : 'tab'} onClick={() => setTab('points')}>
          Punkter{points.length ? ` (${points.length})` : ''}
        </button>
      </div>

      {tab === 'areas' ? (
        areas.length === 0 ? (
          <div className="empty-state"><p>Inga områden finns ännu.</p></div>
        ) : (
          <div className="admin-list fade-in">
            {areas.map(a => (
              <div key={a.id} className="admin-list-item">
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">
                    <span
                      className="map-area-swatch admin-area-swatch"
                      style={{ borderColor: a.color, borderStyle: a.line_style === 'dashed' ? 'dashed' : 'solid' }}
                      aria-hidden="true"
                    />
                    {a.icon && <LucideIcon icon={a.icon} size={16} className="admin-list-icon" />}
                    {a.title}
                  </div>
                  <div className="admin-list-item-meta">
                    <span className={statusBadgeClass(a.status)}>{statusLabel(a.status)}</span>
                    <span>{a.points.length} hörn</span>
                    <span>≈ {polygonAreaKm2(a.points).toFixed(2)} km²</span>
                  </div>
                </div>
                <div className="admin-table-actions">
                  <Link to={`/admin/karta/omrade/${a.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => removeArea(a.id, a.title)}>Ta bort</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        points.length === 0 ? (
          <div className="empty-state"><p>Inga kartpunkter finns ännu.</p></div>
        ) : (
          <div className="admin-list fade-in">
            {points.map(p => (
              <div key={p.id} className="admin-list-item">
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">
                    <LucideIcon icon={p.icon || mapPointTypeIconName(p.point_type)} size={16} className="admin-list-icon" />
                    {p.title}
                  </div>
                  <div className="admin-list-item-meta">
                    <span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span>
                    <span>{mapPointTypeLabel(p.point_type)}</span>
                    <span>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                  </div>
                </div>
                <div className="admin-table-actions">
                  <Link to={`/admin/karta/${p.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => removePoint(p.id)}>Ta bort</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
