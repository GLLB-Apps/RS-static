import { Fragment, useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import type { NavigationItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import LucideIcon from '../../lib/lucide'
import IconPicker from '../../components/admin/IconPicker'
import { MENU_PAGES } from '../../lib/pages'

export default function AdminNavigation() {
  const [items, setItems] = useState<NavigationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showGroup, setShowGroup] = useState(false)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPos, setOverPos] = useState<'before' | 'after'>('before')
  const [customChoices, setCustomChoices] = useState<{ label: string; url: string; icon: string }[]>([])
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    Promise.all([
      supabase.from('navigation_items').select('*').order('sort_order'),
      supabase.from('custom_pages').select('*').eq('status', 'published').order('sort_order'),
    ]).then(([nav, custom]) => {
      setItems(nav.data as NavigationItem[] ?? [])
      setCustomChoices((custom.data as { title: string; slug: string }[] ?? []).map(p => ({ label: p.title, url: `/${p.slug}`, icon: 'file-text' })))
      setLoading(false)
    })
  }

  const topLevel = items.filter(i => !i.parent_id)
  const childrenOf = (id: string) => items.filter(i => i.parent_id === id)
  const byId = Object.fromEntries(items.map(i => [i.id, i]))
  const usedUrls = new Set(items.map(i => i.url))
  const availablePages = [...MENU_PAGES, ...customChoices].filter(p => !usedUrls.has(p.url))

  // Current structure as [{ id, children:[id] }], then persist a new structure.
  function structure() {
    return topLevel.map(t => ({ id: t.id, children: childrenOf(t.id).map(c => c.id) }))
  }
  async function applyStructure(struct: { id: string; children: string[] }[]) {
    let order = 0
    const updates: { id: string; parent_id: string | null; sort_order: number }[] = []
    for (const t of struct) {
      updates.push({ id: t.id, parent_id: null, sort_order: order++ })
      for (const cid of t.children) updates.push({ id: cid, parent_id: t.id, sort_order: order++ })
    }
    const changed = updates.filter(u => byId[u.id] && (byId[u.id].parent_id !== u.parent_id || byId[u.id].sort_order !== u.sort_order))
    await Promise.all(changed.map(u => supabase.from('navigation_items').update({ parent_id: u.parent_id, sort_order: u.sort_order }).eq('id', u.id)))
    load()
  }

  function move(item: NavigationItem, dir: -1 | 1) {
    const struct = structure()
    if (!item.parent_id) {
      const i = struct.findIndex(s => s.id === item.id)
      const j = i + dir
      if (j < 0 || j >= struct.length) return
      ;[struct[i], struct[j]] = [struct[j], struct[i]]
    } else {
      const parent = struct.find(s => s.children.includes(item.id))
      if (!parent) return
      const i = parent.children.indexOf(item.id)
      const j = i + dir
      if (j < 0 || j >= parent.children.length) return
      ;[parent.children[i], parent.children[j]] = [parent.children[j], parent.children[i]]
    }
    applyStructure(struct)
  }

  function indent(item: NavigationItem) {
    const struct = structure()
    const i = struct.findIndex(s => s.id === item.id)
    if (i <= 0) return
    const node = struct[i]
    // Flatten the item plus any sub-items into the group above (two-level menu).
    struct.splice(i, 1)
    struct[i - 1].children.push(node.id, ...node.children)
    applyStructure(struct)
  }

  function outdent(item: NavigationItem) {
    const struct = structure()
    const parent = struct.find(s => s.children.includes(item.id))
    if (!parent) return
    const pi = struct.findIndex(s => s.id === parent.id)
    parent.children = parent.children.filter(id => id !== item.id)
    struct.splice(pi + 1, 0, { id: item.id, children: [] })
    applyStructure(struct)
  }

  // Drag-and-drop reordering / nesting.
  function onRowDragOver(e: DragEvent, item: NavigationItem) {
    if (!dragId || dragId === item.id) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY - r.top < r.height / 2 ? 'before' : 'after'
    if (item.id !== overId || pos !== overPos) { setOverId(item.id); setOverPos(pos) }
  }

  function endDrag() { setDragId(null); setOverId(null) }

  async function dropOnto(targetId: string) {
    const dId = dragId
    endDrag()
    if (!dId || dId === targetId) return
    // Can't drop a group onto its own child.
    if (childrenOf(dId).some(c => c.id === targetId)) return
    const drag = byId[dId]
    const target = byId[targetId]
    if (!drag || !target) return

    const struct = structure()
    // Detach the dragged node. `branch` is the dragged item followed by any
    // sub-items it had — the menu is two levels deep, so when a group is nested
    // into another its sub-items are flattened in alongside it.
    let node: { id: string; children: string[] }
    if (drag.parent_id) {
      const p = struct.find(s => s.children.includes(dId))
      if (p) p.children = p.children.filter(id => id !== dId)
      node = { id: dId, children: [] }
    } else {
      const idx = struct.findIndex(s => s.id === dId)
      node = struct[idx]
      struct.splice(idx, 1)
    }
    const branch = [node.id, ...node.children]
    const targetIsHeading = !target.url

    if (target.parent_id) {
      // Dropping next to a sub-item → insert the whole branch as siblings there.
      const parent = struct.find(s => s.children.includes(targetId))
      if (parent) {
        let ti = parent.children.indexOf(targetId)
        if (overPos === 'after') ti += 1
        parent.children.splice(ti, 0, ...branch)
      } else {
        struct.splice(struct.length, 0, node)
      }
    } else if (targetIsHeading || (childrenOf(targetId).length > 0 && overPos === 'after')) {
      // Drop onto a group — a link-less heading (anywhere on it) or the lower
      // half of a group that already has sub-items → the branch goes inside it.
      const tnode = struct.find(s => s.id === targetId)
      if (tnode) tnode.children.push(...branch)
    } else {
      // Drop next to a top-level item → top-level sibling (keeps its children).
      let ti = struct.findIndex(s => s.id === targetId)
      if (ti < 0) ti = struct.length
      else if (overPos === 'after') ti += 1
      struct.splice(ti, 0, node)
    }
    applyStructure(struct)
  }

  async function addPage(p: { label: string; url: string; icon: string }) {
    const { error } = await supabase.from('navigation_items').insert({
      label: p.label, url: p.url, icon: p.icon, sort_order: items.length + 100, is_active: true, parent_id: null,
    })
    if (error) show('Kunde inte lägga till: ' + error.message, 'error')
    else { show(`”${p.label}” tillagd i menyn`, 'success'); load() }
  }

  async function addItem() {
    if (!newLabel.trim()) { show('Etikett krävs', 'error'); return }
    const { error } = await supabase.from('navigation_items').insert({
      label: newLabel.trim(), url: newUrl.trim(), sort_order: items.length + 100, is_active: true, parent_id: null,
    })
    if (error) show('Kunde inte lägga till: ' + error.message, 'error')
    else { setNewLabel(''); setNewUrl(''); show('Menyval tillagt', 'success'); load() }
  }

  // En grupp är ett menyval utan länk – en ren rubrik som andra val kan ligga under.
  async function addGroup() {
    if (!newGroupLabel.trim()) { show('Gruppnamn krävs', 'error'); return }
    const { error } = await supabase.from('navigation_items').insert({
      label: newGroupLabel.trim(), url: '', sort_order: items.length + 100, is_active: true, parent_id: null,
    })
    if (error) show('Kunde inte skapa grupp: ' + error.message, 'error')
    else { setNewGroupLabel(''); setShowGroup(false); show('Grupp skapad', 'success'); load() }
  }

  function startEdit(item: NavigationItem) {
    setEditingId(item.id); setEditLabel(item.label); setEditUrl(item.url); setIconPickerFor(null)
  }
  async function saveEdit(item: NavigationItem) {
    if (!editLabel.trim()) { show('Etikett krävs', 'error'); return }
    const { error } = await supabase.from('navigation_items').update({ label: editLabel.trim(), url: editUrl.trim() }).eq('id', item.id)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else { setEditingId(null); show('Sparat', 'success'); load() }
  }

  async function setIcon(item: NavigationItem, icon: string | null) {
    setIconPickerFor(null)
    const { error } = await supabase.from('navigation_items').update({ icon }).eq('id', item.id)
    if (error) show('Kunde inte spara ikon', 'error')
    else load()
  }

  async function toggleActive(item: NavigationItem) {
    const { error } = await supabase.from('navigation_items').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) show('Kunde inte uppdatera', 'error')
    else load()
  }

  async function remove(item: NavigationItem) {
    const kids = childrenOf(item.id)
    if (!(await confirm({ message: kids.length ? `Ta bort "${item.label}"? Dess ${kids.length} underval flyttas till toppnivå.` : 'Ta bort detta menyval?', confirmText: 'Ta bort', danger: true }))) return
    if (kids.length) await Promise.all(kids.map(k => supabase.from('navigation_items').update({ parent_id: null }).eq('id', k.id)))
    const { error } = await supabase.from('navigation_items').delete().eq('id', item.id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Borttaget', 'success'); load() }
  }

  function row(item: NavigationItem, isChild: boolean, index: number, siblingCount: number) {
    const editing = editingId === item.id
    const canIndent = !isChild && index > 0
    let dropCls = ''
    if (dragId && overId === item.id && dragId !== item.id) {
      const ownChild = childrenOf(dragId).some(c => c.id === item.id)
      const nestInto = !ownChild && !item.parent_id && (!item.url || (childrenOf(item.id).length > 0 && overPos === 'after'))
      dropCls = nestInto ? ' menu-row-drop-into' : (overPos === 'before' ? ' menu-row-drop-before' : ' menu-row-drop-after')
    }
    return (
      <div
        key={item.id}
        className={`menu-row${isChild ? ' menu-row-child' : ''}${item.is_active ? '' : ' menu-row-hidden'}${dragId === item.id ? ' menu-row-dragging' : ''}${dropCls}`}
        draggable={!editing}
        onDragStart={e => { setDragId(item.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => onRowDragOver(e, item)}
        onDrop={e => { e.preventDefault(); dropOnto(item.id) }}
        onDragEnd={endDrag}
      >
        <span className="menu-row-grip" data-tooltip="Dra för att flytta" aria-hidden="true">⠿</span>
        <div className="menu-row-reorder">
          <button className="menu-icon-btn" onClick={() => move(item, -1)} disabled={index === 0} data-tooltip="Flytta upp" aria-label="Flytta upp">↑</button>
          <button className="menu-icon-btn" onClick={() => move(item, 1)} disabled={index === siblingCount - 1} data-tooltip="Flytta ned" aria-label="Flytta ned">↓</button>
        </div>

        {editing ? (
          <div className="menu-row-edit">
            <input className="form-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Etikett" />
            <input className="form-input" value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="/länk (tom = grupp)" />
            <button className="btn btn-primary btn-xs" onClick={() => saveEdit(item)}>Spara</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>Avbryt</button>
          </div>
        ) : (
          <>
            <span className="menu-row-icon">{item.icon ? <LucideIcon icon={item.icon} size={18} /> : <span className="menu-row-icon-empty" aria-hidden="true">◦</span>}</span>
            <span className="menu-row-label">{item.label}</span>
            <span className="menu-row-url">{item.url || 'grupp'}</span>
            {!item.is_active && <span className="badge badge-muted">Dold</span>}
          </>
        )}

        {!editing && (
          <div className="menu-row-tools">
            {isChild
              ? <button className="menu-icon-btn" onClick={() => outdent(item)} data-tooltip="Gör till toppnivå" aria-label="Gör till toppnivå">⇤</button>
              : <button className="menu-icon-btn" onClick={() => indent(item)} disabled={!canIndent} data-tooltip="Gör till underval (av valet ovanför)" aria-label="Gör till underval">⇥</button>}
            <button className={iconPickerFor === item.id ? 'menu-icon-btn is-on' : 'menu-icon-btn'} onClick={() => setIconPickerFor(iconPickerFor === item.id ? null : item.id)} data-tooltip="Välj ikon" aria-label="Välj ikon">✦</button>
            <button className="menu-icon-btn" onClick={() => toggleActive(item)} data-tooltip={item.is_active ? 'Dölj' : 'Visa'} aria-label={item.is_active ? 'Dölj' : 'Visa'}>{item.is_active ? '👁' : '🚫'}</button>
            <button className="menu-icon-btn" onClick={() => startEdit(item)} data-tooltip="Redigera" aria-label="Redigera">✎</button>
            <button className="menu-icon-btn danger" onClick={() => remove(item)} data-tooltip="Ta bort" aria-label="Ta bort">✕</button>
          </div>
        )}

        {iconPickerFor === item.id && (
          <div className="menu-icon-picker">
            <IconPicker value={item.icon} onChange={ic => setIcon(item, ic)} />
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Meny</h1>
      </div>

      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        <strong>Dra</strong> raderna (⠿) för att flytta och sortera – släpp en rad <strong>på en grupp</strong> för att lägga valet inuti gruppen (raden markeras då grön).
        Du kan också använda <strong>⇥</strong> för att göra ett val till underval av valet ovanför, <strong>⇤</strong> för att flytta tillbaka till toppnivå, och ↑/↓ för att ordna.
        Välj ikon med ✦. Lämna länken tom för en ren grupprubrik. Menyn styr både huvudmenyn och sidfoten.
      </p>

      <div className="card menu-add-card">
        <h3 className="menu-add-title">Lägg till en sida i menyn</h3>
        {availablePages.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Alla sidor finns redan i menyn.</p>
        ) : (
          <div className="menu-page-choices">
            {availablePages.map(p => (
              <button key={p.url} className="menu-page-choice" onClick={() => addPage(p)} data-tooltip={`Lägg till ${p.label}`}>
                <span className="menu-page-choice-icon"><LucideIcon icon={p.icon} size={20} /></span>
                <span className="menu-page-choice-text">
                  <span className="menu-page-choice-label">{p.label}</span>
                  <span className="menu-page-choice-url">{p.url}</span>
                </span>
                <span className="menu-page-choice-plus" aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        )}

        <button type="button" className="menu-add-custom-toggle" onClick={() => setShowCustom(v => !v)}>
          {showCustom ? '− Dölj egen länk' : '+ Egen länk (extern adress eller rubrik)'}
        </button>
        {showCustom && (
          <div className="menu-add">
            <input className="form-input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Etikett – t.ex. Facebook" onKeyDown={e => e.key === 'Enter' && addItem()} />
            <input className="form-input" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Länk – t.ex. https://… (tom = grupprubrik)" onKeyDown={e => e.key === 'Enter' && addItem()} />
            <button className="btn btn-primary" onClick={addItem}>Lägg till</button>
          </div>
        )}

        <button type="button" className="menu-add-custom-toggle" onClick={() => setShowGroup(v => !v)}>
          {showGroup ? '− Dölj ny grupp' : '+ Ny grupp (rubrik utan länk)'}
        </button>
        {showGroup && (
          <div className="menu-add">
            <input className="form-input" value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)} placeholder="Gruppnamn – t.ex. Om projektet" onKeyDown={e => e.key === 'Enter' && addGroup()} />
            <button className="btn btn-primary" onClick={addGroup}>Skapa grupp</button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state"><p>Inga menyval finns ännu.</p></div>
      ) : (
        <div className="menu-tree">
          {topLevel.map((item, ti) => {
            const kids = childrenOf(item.id)
            return (
              <Fragment key={item.id}>
                {row(item, false, ti, topLevel.length)}
                {kids.map((c, ci) => row(c, true, ci, kids.length))}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
