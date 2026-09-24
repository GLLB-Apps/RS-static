import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Check, Pencil } from 'lucide-react'
import type { IntranetTask } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { useMarkIntranetRead } from '../../lib/intranetNotifications'

// Delade uppgiftslistor. Poster grupperas på fältet "list"; avklarade hamnar
// längst ned inom sin grupp. Vem som helst i intranätet kan bocka av och lägga till.
//
// Både gruppens rubrik och uppgiftens text går att skriva om på plats. En grupp
// är inget eget objekt utan bara ett värde på "list", så att byta namn betyder
// att skriva om fältet på varje uppgift i gruppen.
const UNGROUPED = 'Att göra'

export default function IntranetTasks() {
  const { user, isAdmin, canWriteIntranet } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [tasks, setTasks] = useState<IntranetTask[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [list, setList] = useState('')
  // Vad som redigeras just nu: en uppgift (id) eller en grupp (dess namn).
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  useMarkIntranetRead('tasks', !loading)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('intranet_tasks').select('*').order('created_at', { ascending: true }).then(({ data }) => {
      setTasks((data as IntranetTask[]) ?? [])
      setLoading(false)
    })
  }

  const lists = useMemo(() => Array.from(new Set(tasks.map(t => t.list).filter(Boolean))) as string[], [tasks])

  // Gruppera per lista, avklarade sist inom gruppen.
  const grouped = useMemo(() => {
    const map = new Map<string, IntranetTask[]>()
    for (const t of tasks) {
      const key = t.list || UNGROUPED
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.done) - Number(b.done) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    return Array.from(map.entries())
  }, [tasks])

  async function add() {
    if (!text.trim()) return
    const { error } = await supabase.from('intranet_tasks').insert({
      text: text.trim(),
      list: list.trim() || null,
      done: false,
      created_by: user?.id ?? null,
    })
    if (error) { show('Kunde inte lägga till: ' + error.message, 'error'); return }
    setText(''); load()
  }

  async function toggle(t: IntranetTask) {
    const done = !t.done
    // Optimistisk uppdatering så avbockningen känns direkt.
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done } : x))
    const { error } = await supabase.from('intranet_tasks').update({
      done, done_by: done ? (user?.email ?? null) : null,
    }).eq('id', t.id)
    if (error) { show('Kunde inte spara: ' + error.message, 'error'); load() }
  }

  function startEditTask(t: IntranetTask) {
    setEditingGroup(null)
    setEditingTask(t.id)
    setEditValue(t.text)
  }

  function startEditGroup(name: string) {
    setEditingTask(null)
    setEditingGroup(name)
    // Den namnlösa gruppen har inget sparat värde – börja tomt i stället för
    // med platshållarrubriken, så att den inte råkar sparas som riktigt namn.
    setEditValue(name === UNGROUPED ? '' : name)
  }

  function cancelEdit() {
    setEditingTask(null)
    setEditingGroup(null)
    setEditValue('')
  }

  /** Skriver om texten på en uppgift. */
  async function saveTaskText(t: IntranetTask) {
    const next = editValue.trim()
    if (!next || next === t.text) { cancelEdit(); return }
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, text: next } : x))
    cancelEdit()
    const { error } = await supabase.from('intranet_tasks').update({ text: next }).eq('id', t.id)
    if (error) { show('Kunde inte spara: ' + error.message, 'error'); load() }
  }

  /**
   * Döper om en grupp. Gruppen finns bara som värdet på "list", så varje
   * uppgift i den skrivs om. Tomt namn flyttar tillbaka dem till den namnlösa
   * gruppen.
   */
  async function saveGroupName(name: string, items: IntranetTask[]) {
    const next = editValue.trim()
    const nextValue = next || null
    const current = name === UNGROUPED ? null : name
    if (nextValue === current) { cancelEdit(); return }
    if (nextValue && lists.some(l => l !== current && l.toLowerCase() === nextValue.toLowerCase())) {
      if (!(await confirm({ message: `Det finns redan en lista som heter "${nextValue}". Slå ihop grupperna?`, confirmText: 'Slå ihop' }))) return
    }
    const ids = items.map(t => t.id)
    setTasks(prev => prev.map(x => ids.includes(x.id) ? { ...x, list: nextValue } : x))
    cancelEdit()
    for (const id of ids) {
      const { error } = await supabase.from('intranet_tasks').update({ list: nextValue }).eq('id', id)
      if (error) { show('Kunde inte byta namn: ' + error.message, 'error'); load(); return }
    }
  }

  async function remove(t: IntranetTask) {
    if (!(await confirm({ message: 'Ta bort uppgiften?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('intranet_tasks').delete().eq('id', t.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    setTasks(prev => prev.filter(x => x.id !== t.id))
  }

  const canRemove = (t: IntranetTask) => t.created_by === user?.id || isAdmin

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Uppgifter</h1>
      </div>

      {canWriteIntranet && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="intranet-task-add">
            <input
              className="form-input"
              placeholder="Ny uppgift…"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
            />
            <input
              className="form-input intranet-task-list-input"
              list="task-lists"
              placeholder="Lista (valfritt)"
              value={list}
              onChange={e => setList(e.target.value)}
            />
            <datalist id="task-lists">{lists.map(l => <option key={l} value={l} />)}</datalist>
            <button className="btn btn-primary" onClick={add}><Plus size={16} /> Lägg till</button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state"><p>Inga uppgifter ännu.</p></div>
      ) : (
        grouped.map(([name, items]) => {
          const openCount = items.filter(t => !t.done).length
          return (
            <section key={name} className="intranet-task-group">
              {editingGroup === name ? (
                <div className="intranet-task-edit intranet-task-edit-group">
                  <input
                    className="form-input"
                    autoFocus
                    placeholder="Rubrik på gruppen (tom = ingen)"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveGroupName(name, items)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => saveGroupName(name, items)}>Spara</button>
                  <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Avbryt</button>
                </div>
              ) : (
                <h2 className="intranet-task-group-title">
                  {name} <span className="intranet-task-count">{openCount} kvar</span>
                  {canWriteIntranet && (
                    <button
                      className="intdoc-icon-btn intranet-task-rename"
                      data-tooltip="Byt namn på gruppen"
                      aria-label={`Byt namn på gruppen ${name}`}
                      onClick={() => startEditGroup(name)}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </h2>
              )}
              <ul className="intranet-task-list">
                {items.map(t => (
                  <li key={t.id} className={t.done ? 'intranet-task is-done' : 'intranet-task'}>
                    <button className="intranet-task-check" onClick={() => canWriteIntranet && toggle(t)} disabled={!canWriteIntranet} aria-pressed={t.done} aria-label={t.done ? 'Markera som ej klar' : 'Markera som klar'}>
                      {t.done && <Check size={14} aria-hidden="true" />}
                    </button>
                    {editingTask === t.id ? (
                      <span className="intranet-task-edit">
                        <input
                          className="form-input"
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveTaskText(t)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => saveTaskText(t)}>Spara</button>
                        <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Avbryt</button>
                      </span>
                    ) : (
                      <>
                        <span className="intranet-task-text">{t.text}</span>
                        {t.done && t.done_by && <span className="intranet-task-by">{t.done_by}</span>}
                        {canWriteIntranet && (
                          <button className="intdoc-icon-btn intranet-task-edit-btn" data-tooltip="Ändra texten" aria-label="Ändra texten" onClick={() => startEditTask(t)}><Pencil size={14} /></button>
                        )}
                        {canRemove(t) && (
                          <button className="intdoc-icon-btn danger intranet-task-remove" data-tooltip="Ta bort" aria-label="Ta bort" onClick={() => remove(t)}><Trash2 size={14} /></button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
