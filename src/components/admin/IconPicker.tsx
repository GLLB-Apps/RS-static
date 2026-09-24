// Reusable searchable Lucide icon picker, used wherever the admin chooses an
// icon (menu editor, topics, …). Value is a Lucide icon name (kebab-case).
//
// Utöver den kurerade uppsättningen går det att hämta in vilken Lucide-ikon som
// helst: klistra in en adress från lucide.dev eller skriv ikonens namn rakt av.
// En hämtad ikon kan sparas i den egna samlingen (kollektionen `custom_icons`)
// och ligger då kvar överst i väljaren – se lib/customIcons.
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import LucideIcon, { ICON_LIBRARY, isLucideIconName, parseLucideUrl } from '../../lib/lucide'
import { useCustomIcons, saveCustomIcon, deleteCustomIcon } from '../../lib/customIcons'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'

interface Props {
  value?: string | null
  onChange: (name: string | null) => void
  allowNone?: boolean
  autoFocus?: boolean
}

const inLibrary = (name: string) => ICON_LIBRARY.some(d => d.name === name)

/**
 * Tolkar sökrutan som ett försök att hämta in en ikon utifrån: antingen en
 * adress från lucide.dev eller ett ikonnamn skrivet rakt av. Namn som redan
 * finns i den kurerade uppsättningen räknas inte – de hittas ju i listan nedan.
 */
function externalCandidate(query: string): string | null {
  const fromUrl = parseLucideUrl(query)
  if (fromUrl) return isLucideIconName(fromUrl) ? fromUrl : null
  const typed = query.trim().toLowerCase()
  if (!typed || inLibrary(typed)) return null
  return isLucideIconName(typed) ? typed : null
}

export default function IconPicker({ value, onChange, allowNone = true, autoFocus = true }: Props) {
  const [query, setQuery] = useState('')
  const [candidate, setCandidate] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { icons: customIcons, refresh } = useCustomIcons()
  const { user } = useAuth()
  const { show } = useToast()

  useEffect(() => { setCandidate(externalCandidate(query)) }, [query])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? ICON_LIBRARY.filter(d => d.name.includes(q) || d.label.toLowerCase().includes(q) || d.keywords.includes(q))
      : ICON_LIBRARY
    const map = new Map<string, typeof ICON_LIBRARY>()
    for (const d of list) {
      if (!map.has(d.group)) map.set(d.group, [])
      map.get(d.group)!.push(d)
    }
    return Array.from(map.entries())
  }, [query])

  // Egna ikoner filtreras på samma sökord som resten.
  const ownIcons = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customIcons
    return customIcons.filter(i => i.name.includes(q) || (i.label ?? '').toLowerCase().includes(q))
  }, [customIcons, query])

  const alreadySaved = candidate ? customIcons.some(i => i.name === candidate) : false

  async function addCandidate() {
    if (!candidate) return
    setBusy(true)
    const error = await saveCustomIcon(candidate, null, user?.email ?? null)
    setBusy(false)
    if (error) { show('Kunde inte spara ikonen: ' + error, 'error'); return }
    await refresh()
    onChange(candidate)
    setQuery('')
    show(`Ikonen "${candidate}" sparades i egna ikoner`, 'success')
  }

  async function removeIcon(id: string, name: string) {
    setBusy(true)
    const error = await deleteCustomIcon(id)
    setBusy(false)
    if (error) { show('Kunde inte ta bort ikonen: ' + error, 'error'); return }
    await refresh()
    // Innehållet som redan pekar på namnet fortsätter rendera – bara genvägen
    // i väljaren försvinner.
    if (value === name) show('Ikonen togs bort ur samlingen, men den syns kvar där den redan används', 'success')
  }

  return (
    <div className="icon-picker">
      <input
        className="form-input icon-picker-search"
        placeholder="Sök ikon, eller klistra in från lucide.dev…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      <div className="icon-picker-scroll">
        {allowNone && (
          <button
            type="button"
            className={`icon-picker-btn icon-picker-none${!value ? ' active' : ''}`}
            data-tooltip="Ingen ikon"
            onClick={() => onChange(null)}
          >
            Ingen
          </button>
        )}

        {candidate && (
          <div className="icon-picker-group">
            <div className="icon-picker-group-title">Från Lucide ✨</div>
            <div className="icon-picker-found">
              <button
                type="button"
                className={`icon-picker-btn${value === candidate ? ' active' : ''}`}
                data-tooltip={candidate}
                aria-label={candidate}
                aria-pressed={value === candidate}
                onClick={() => onChange(candidate)}
              >
                <LucideIcon icon={candidate} size={20} />
              </button>
              <span className="icon-picker-found-name">{candidate}</span>
              {alreadySaved ? (
                <span className="icon-picker-found-note">Finns i egna ikoner</span>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={addCandidate}>
                  Spara i egna ikoner
                </button>
              )}
            </div>
          </div>
        )}

        {ownIcons.length > 0 && (
          <div className="icon-picker-group">
            <div className="icon-picker-group-title">Egna ikoner</div>
            <div className="icon-picker-grid">
              {ownIcons.map(i => (
                <span key={i.id} className="icon-picker-own">
                  <button
                    type="button"
                    className={`icon-picker-btn${value === i.name ? ' active' : ''}`}
                    data-tooltip={i.label || i.name}
                    aria-label={i.label || i.name}
                    aria-pressed={value === i.name}
                    onClick={() => onChange(i.name)}
                  >
                    <LucideIcon icon={i.name} size={20} />
                  </button>
                  <button
                    type="button"
                    className="icon-picker-own-remove"
                    data-tooltip={`Ta bort ${i.name} ur samlingen`}
                    aria-label={`Ta bort ${i.name} ur samlingen`}
                    disabled={busy}
                    onClick={() => removeIcon(i.id, i.name)}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {groups.map(([group, defs]) => (
          <div key={group} className="icon-picker-group">
            <div className="icon-picker-group-title">{group}</div>
            <div className="icon-picker-grid">
              {defs.map(d => (
                <button
                  key={d.name}
                  type="button"
                  className={`icon-picker-btn${value === d.name ? ' active' : ''}`}
                  data-tooltip={d.label}
                  aria-label={d.label}
                  aria-pressed={value === d.name}
                  onClick={() => onChange(d.name)}
                >
                  <LucideIcon icon={d.name} size={20} />
                </button>
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && ownIcons.length === 0 && !candidate && (
          <p className="icon-picker-empty">
            {parseLucideUrl(query)
              ? 'Ingen sådan Lucide-ikon hittades.'
              : `Inga ikoner matchar ”${query}”. Heter ikonen något annat på lucide.dev? Klistra in adressen hit.`}
          </p>
        )}
      </div>
    </div>
  )
}
