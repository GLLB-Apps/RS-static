import { useEffect, useMemo, useState } from 'react'
import { FileText, Download, Eye, X, Trash2, Pencil, FolderPlus } from 'lucide-react'
import type { InternalDocCategory, InternalDocument } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort } from '../../lib/utils'
import Dropzone from '../../components/admin/Dropzone'

function fileTypeFromName(name: string): string {
  const clean = name.split(/[?#]/)[0]
  const ext = clean.includes('.') ? clean.split('.').pop() ?? '' : ''
  return ext ? ext.toUpperCase() : ''
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const e = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, e)).toFixed(e === 0 ? 0 : 1)} ${units[e]}`
}

const IMAGE_TYPES = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG', 'AVIF']
const canPreview = (t: string | null) => t === 'PDF' || IMAGE_TYPES.includes(t ?? '')

interface Pending {
  file_url: string
  file_name: string
  file_type: string
  file_size: number
  title: string
  category_id: string
  owner: string
  description: string
}

export default function AdminInternalDocs() {
  const { user, canWriteIntranet } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const uploaderName = user?.email ?? ''

  const [categories, setCategories] = useState<InternalDocCategory[]>([])
  const [docs, setDocs] = useState<InternalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [newCategory, setNewCategory] = useState('')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [pending, setPending] = useState<Pending | null>(null)
  const [editing, setEditing] = useState<InternalDocument | null>(null)
  const [preview, setPreview] = useState<InternalDocument | null>(null)

  useEffect(() => { load() }, [])

  function load() {
    Promise.all([
      supabase.from('internal_doc_categories').select('*'),
      supabase.from('internal_documents').select('*').order('created_at', { ascending: false }),
    ]).then(([c, d]) => {
      setCategories(((c.data as InternalDocCategory[]) ?? []).sort((a, b) => a.sort_order - b.sort_order))
      setDocs((d.data as InternalDocument[]) ?? [])
      setLoading(false)
    })
  }

  const catName = (id: string | null) => categories.find(c => c.id === id)?.name ?? 'Okategoriserad'

  async function reloadCategories() {
    const { data } = await supabase.from('internal_doc_categories').select('*')
    setCategories(((data as InternalDocCategory[]) ?? []).sort((a, b) => a.sort_order - b.sort_order))
  }

  async function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    const { error } = await supabase.from('internal_doc_categories').insert({ name, sort_order: categories.length })
    if (error) show('Kunde inte skapa kategori: ' + error.message, 'error')
    else { setNewCategory(''); show('Kategori skapad', 'success'); reloadCategories() }
  }

  async function removeCategory(cat: InternalDocCategory) {
    if (!(await confirm({ message: `Ta bort kategorin "${cat.name}"? Dokumenten blir okategoriserade.`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('internal_doc_categories').delete().eq('id', cat.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    if (filterCat === cat.id) setFilterCat('all')
    show('Kategori borttagen', 'success')
    reloadCategories()
  }

  function onUploaded(url: string, file: File) {
    const dot = file.name.lastIndexOf('.')
    setPending({
      file_url: url,
      file_name: file.name,
      file_type: fileTypeFromName(file.name),
      file_size: file.size,
      title: dot > 0 ? file.name.slice(0, dot) : file.name,
      category_id: categories[0]?.id ?? '',
      owner: uploaderName,
      description: '',
    })
  }

  async function savePending() {
    if (!pending) return
    if (!pending.title.trim()) { show('Titel krävs', 'error'); return }
    const { error } = await supabase.from('internal_documents').insert({
      title: pending.title.trim(),
      description: pending.description || null,
      file_url: pending.file_url,
      file_name: pending.file_name,
      file_type: pending.file_type,
      file_size: pending.file_size,
      category_id: pending.category_id || null,
      owner: pending.owner.trim() || uploaderName || null,
      uploaded_by: uploaderName || null,
      uploaded_by_id: user?.id || null,
    })
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else { show('Dokument tillagt', 'success'); setPending(null); load() }
  }

  async function saveEdit() {
    if (!editing) return
    if (!editing.title.trim()) { show('Titel krävs', 'error'); return }
    const { error } = await supabase.from('internal_documents').update({
      title: editing.title.trim(),
      description: editing.description || null,
      category_id: editing.category_id || null,
      owner: editing.owner?.trim() || null,
    }).eq('id', editing.id)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else {
      show('Sparat', 'success')
      setDocs(prev => prev.map(d => d.id === editing.id ? editing : d))
      setEditing(null)
    }
  }

  async function removeDoc(doc: InternalDocument) {
    if (!(await confirm({ message: `Ta bort "${doc.title}" permanent?`, confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('internal_documents').delete().eq('id', doc.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    show('Dokument borttaget', 'success')
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter(d => {
      if (filterCat === 'uncat' && d.category_id) return false
      if (filterCat !== 'all' && filterCat !== 'uncat' && d.category_id !== filterCat) return false
      if (!q) return true
      return [d.title, d.description, d.owner, d.uploaded_by, catName(d.category_id)]
        .some(v => (v ?? '').toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, search, filterCat, categories])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Interna dokument</h1>
      </div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        Intern dokumentbank – dessa filer visas aldrig på den publika webbplatsen. Här kan ansvariga
        ladda upp, kategorisera, söka och ladda ner dokument.
      </p>

      <div className="intdoc-layout">
        {/* LEFT: uploaded files + search */}
        <div className="intdoc-left">
          <div className="intdoc-toolbar">
            <input className="form-input intdoc-search" placeholder="Sök dokument, ansvarig, kategori…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="intdoc-filter-pills">
              <button className={filterCat === 'all' ? 'intdoc-pill active' : 'intdoc-pill'} onClick={() => setFilterCat('all')}>Alla</button>
              {categories.map(c => (
                <button key={c.id} className={filterCat === c.id ? 'intdoc-pill active' : 'intdoc-pill'} onClick={() => setFilterCat(c.id)}>{c.name}</button>
              ))}
              <button className={filterCat === 'uncat' ? 'intdoc-pill active' : 'intdoc-pill'} onClick={() => setFilterCat('uncat')}>Okategoriserade</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state"><p>{docs.length === 0 ? 'Inga dokument har laddats upp ännu.' : 'Inga dokument matchar sökningen.'}</p></div>
          ) : (
            <div className="intdoc-list">
              {filtered.map(doc => (
                <div key={doc.id} className="intdoc-item">
                  <FileText size={20} className="intdoc-item-icon" />
                  <div className="intdoc-item-main">
                    <div className="intdoc-item-title">{doc.title}</div>
                    <div className="intdoc-item-meta">
                      <span className="intdoc-type-badge">{doc.file_type || 'FIL'}</span>
                      <span>{formatBytes(doc.file_size)}</span>
                      <span className="intdoc-item-cat">{catName(doc.category_id)}</span>
                    </div>
                    {doc.description && <div className="intdoc-item-desc">{doc.description}</div>}
                    <div className="intdoc-item-people">
                      Ansvarig: <strong>{doc.owner || '—'}</strong> · Uppladdad av {doc.uploaded_by || '—'} · {formatDateShort(doc.created_at)}
                    </div>
                  </div>
                  <div className="intdoc-actions">
                    {canPreview(doc.file_type) && doc.file_url && (
                      <button className="intdoc-icon-btn" data-tooltip="Förhandsvisa" aria-label="Förhandsvisa" onClick={() => setPreview(doc)}><Eye size={16} /></button>
                    )}
                    {doc.file_url && (
                      <a className="intdoc-icon-btn" data-tooltip="Ladda ner" aria-label="Ladda ner" href={doc.file_url} download={doc.file_name ?? undefined} target="_blank" rel="noopener noreferrer"><Download size={16} /></a>
                    )}
                    {canWriteIntranet && <button className="intdoc-icon-btn" data-tooltip="Redigera" aria-label="Redigera" onClick={() => setEditing(doc)}><Pencil size={16} /></button>}
                    {canWriteIntranet && <button className="intdoc-icon-btn danger" data-tooltip="Ta bort" aria-label="Ta bort" onClick={() => removeDoc(doc)}><Trash2 size={16} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: categories + upload (dolt för läsbehörighet) */}
        {canWriteIntranet && <div className="intdoc-right">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Ladda upp dokument</h3>
            {pending ? (
              <div className="intdoc-form">
                <div className="doc-file-chip" style={{ marginBottom: 'var(--space-3)' }}>
                  <span className="doc-file-type">{pending.file_type || 'FIL'}</span>
                  <span className="doc-file-link">{pending.file_name}</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{formatBytes(pending.file_size)}</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Titel *</label>
                  <input className="form-input" value={pending.title} onChange={e => setPending({ ...pending, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={pending.category_id} onChange={e => setPending({ ...pending, category_id: e.target.value })}>
                    <option value="">— Okategoriserad —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Dokumentansvarig</label>
                  <input className="form-input" value={pending.owner} onChange={e => setPending({ ...pending, owner: e.target.value })} placeholder={uploaderName} />
                </div>
                <div className="form-group">
                  <label className="form-label">Beskrivning</label>
                  <textarea className="form-textarea" rows={2} value={pending.description} onChange={e => setPending({ ...pending, description: e.target.value })} />
                </div>
                <div className="admin-form-actions">
                  <button className="btn btn-primary" onClick={savePending}>Spara dokument</button>
                  <button className="btn btn-ghost" onClick={() => setPending(null)}>Avbryt</button>
                </div>
              </div>
            ) : (
              <Dropzone
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.zip,image/*,application/pdf"
                label="Dra och släpp ett dokument här"
                hint="PDF, Word, Excel, bilder m.fl. – eller klicka för att välja"
                onUploaded={onUploaded}
                onError={msg => show('Uppladdning misslyckades: ' + msg, 'error')}
              />
            )}
          </div>

          <div className="card intdoc-cats">
            <h3 style={{ margin: 0 }}>Kategorier</h3>
            <div className="intdoc-cat-add">
              <input className="form-input" placeholder="Ny kategori…" value={newCategory}
                onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <button className="btn btn-secondary btn-sm" onClick={addCategory}><FolderPlus size={16} /> Lägg till</button>
            </div>
            {categories.length > 0 && (
              <div className="intdoc-cat-list">
                {categories.map(c => (
                  <span key={c.id} className="intdoc-cat-chip">
                    {c.name}
                    <button className="intdoc-cat-remove" data-tooltip="Ta bort kategori" aria-label={`Ta bort kategorin ${c.name}`} onClick={() => removeCategory(c)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>}
      </div>

      {/* Edit metadata modal */}
      {editing && (
        <div className="intdoc-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="intdoc-modal" onClick={e => e.stopPropagation()}>
            <div className="intdoc-modal-head">
              <h3>Redigera dokument</h3>
              <button className="intdoc-icon-btn" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Titel *</label>
              <input className="form-input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={editing.category_id ?? ''} onChange={e => setEditing({ ...editing, category_id: e.target.value || null })}>
                  <option value="">— Okategoriserad —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dokumentansvarig</label>
                <input className="form-input" value={editing.owner ?? ''} onChange={e => setEditing({ ...editing, owner: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Beskrivning</label>
              <textarea className="form-textarea" rows={2} value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="admin-form-actions">
              <button className="btn btn-primary" onClick={saveEdit}>Spara</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Avbryt</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="intdoc-modal-backdrop" onClick={() => setPreview(null)}>
          <div className="intdoc-modal intdoc-preview" onClick={e => e.stopPropagation()}>
            <div className="intdoc-modal-head">
              <h3>{preview.title}</h3>
              <div className="intdoc-actions">
                {preview.file_url && (
                  <a className="btn btn-secondary btn-sm" href={preview.file_url} download={preview.file_name ?? undefined} target="_blank" rel="noopener noreferrer"><Download size={15} /> Ladda ner</a>
                )}
                <button className="intdoc-icon-btn" onClick={() => setPreview(null)}><X size={18} /></button>
              </div>
            </div>
            <div className="intdoc-preview-body">
              {preview.file_type === 'PDF' ? (
                <iframe src={preview.file_url ?? ''} title={preview.title} className="intdoc-preview-frame" />
              ) : IMAGE_TYPES.includes(preview.file_type ?? '') ? (
                <img src={preview.file_url ?? ''} alt={preview.title} className="intdoc-preview-img" />
              ) : (
                <p className="text-muted">Ingen förhandsvisning tillgänglig – ladda ner filen för att öppna den.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
