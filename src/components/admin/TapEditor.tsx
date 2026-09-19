import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ContentBlock, DocumentItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { headingLevel, internalPath, normalizeUrl } from '../../lib/utils'
import { blocksToMarkdown, markdownToBlocks } from '../../lib/markdownBlocks'
import HeadingMenu from './HeadingMenu'
import MediaPicker from './MediaPicker'
import PdfImportDialog from './PdfImportDialog'
import UploadDialog from './UploadDialog'

// A document-style editor for non-technical admins: click anywhere and type,
// press Enter for a new line, and tap the toolbar to turn a line into a heading
// or quote — no manual "block building". Richer elements (image, factbox, …)
// are inserted from the same toolbar and edited inline. Stores the same
// ContentBlock[] shape the public site already renders.

const TEXT_TYPES = ['heading', 'paragraph', 'quote'] as const
type TextType = typeof TEXT_TYPES[number]
const isText = (t: string): t is TextType => (TEXT_TYPES as readonly string[]).includes(t)

const INSERTS: { type: ContentBlock['type']; label: string }[] = [
  { type: 'image', label: 'Bild' },
  { type: 'factbox', label: 'Faktaruta' },
  { type: 'warning', label: 'Varningsruta' },
  { type: 'list', label: 'Punktlista' },
  { type: 'cta', label: 'Uppmaning' },
  { type: 'video', label: 'Video' },
  { type: 'button', label: 'Knapp' },
  { type: 'links', label: 'Länklista' },
  { type: 'table', label: 'Tabell' },
  { type: 'comparison', label: 'Jämförelse' },
  { type: 'sources', label: 'Källor' },
  { type: 'divider', label: 'Avdelare' },
]

// Vad varje verktyg skriver in i MD-läget — samma knapp, samma block, oavsett
// läge. {} markerar var markören ska stå efteråt.
const MD_SNIPPET: Partial<Record<ContentBlock['type'], string>> = {
  paragraph: '{}',
  quote: '> {}',
  image: '![{}](bildadress "bildtext")',
  factbox: ':::fakta {}\nText i rutan.\n:::',
  warning: ':::varning {}\nText i rutan.\n:::',
  list: '- {}',
  cta: ':::uppmaning {}\n- [Knapptext](https://…)\n:::',
  video: ':::video {}\nhttps://…\n:::',
  button: '[{}](https://…)',
  links: ':::länkar {}\n- [Text](https://…)\n:::',
  table: '| {} | Kolumn 2 |\n| --- | --- |\n|  |  |',
  comparison: ':::jämförelse {}\n- Etikett: Värde\n:::',
  sources: ':::källor\n- [{}](https://…)\n:::',
  divider: '---{}',
}
const headingSnippet = (level: number) => `${'#'.repeat(level)} {}`

// Blocktyper som inte går att lägga till längre men som finns i redan sparat
// innehåll. "Extern resurs" ersattes av knappen, som själv känner igen en
// extern adress — gamla rutor går fortfarande att redigera och visa.
const LEGACY_LABELS: Partial<Record<ContentBlock['type'], string>> = {
  resource: 'Extern resurs (äldre ruta)',
}

const blockLabel = (type: ContentBlock['type']) =>
  INSERTS.find(x => x.type === type)?.label ?? LEGACY_LABELS[type] ?? type

/** Publicerade dokument att länka till, hämtas en gång per editor. */
function usePublishedDocuments() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  useEffect(() => {
    let active = true
    supabase.from('documents').select('*').eq('status', 'published').order('published_at', { ascending: false })
      .then(({ data }) => { if (active) setDocs((data as DocumentItem[] ?? []).filter(d => d.file_url || d.external_url)) })
    return () => { active = false }
  }, [])
  return docs
}

const documentUrl = (doc: DocumentItem) => doc.file_url || doc.external_url || ''

/**
 * Väljare som fyller i länken till ett uppladdat dokument, så att en knapp kan
 * peka på t.ex. ett yttrande utan att adressen behöver klistras in för hand.
 */
function DocumentPicker({ docs, url, onPick }: {
  docs: DocumentItem[]
  url: string
  onPick: (doc: DocumentItem) => void
}) {
  if (docs.length === 0) {
    return (
      <p className="form-hint">
        Inga publicerade dokument att länka till ännu — ladda upp under Dokument först.
      </p>
    )
  }
  return (
    <>
      <select
        className="form-select"
        value={docs.some(d => documentUrl(d) === url) ? url : ''}
        onChange={e => {
          const doc = docs.find(d => documentUrl(d) === e.target.value)
          if (doc) onPick(doc)
        }}
        aria-label="Välj dokument"
      >
        <option value="">Välj ett dokument…</option>
        {docs.map(d => (
          <option key={d.id} value={documentUrl(d)}>
            {d.title}{d.file_type ? ` (${d.file_type})` : ''}
          </option>
        ))}
      </select>
      <p className="form-hint">…eller klistra in en egen länk i fältet ovan.</p>
    </>
  )
}

/**
 * Rutnätsredigering för tabellblocket. Raderna kan vara olika långa i sparad
 * data (PDF-import ger ojämna tabeller), så allt fylls ut till samma bredd
 * innan det visas — annars hamnar cellerna i fel kolumn.
 */
function TableEditor({ block, onChange }: { block: ContentBlock; onChange: (updates: Partial<ContentBlock>) => void }) {
  const columns = block.columns ?? []
  const cells = block.cells ?? []
  const width = Math.max(columns.length, ...cells.map(r => r.length), 1)
  const pad = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? '')
  const head = pad(columns)
  const body = cells.map(pad)

  return (
    <div className="tap-table">
      <input
        className="form-input"
        type="text"
        value={block.title ?? ''}
        onChange={e => onChange({ title: e.target.value })}
        placeholder="Rubrik över tabellen (valfritt)"
      />
      <div className="tap-table-scroll">
        <table>
          <thead>
            <tr>
              {head.map((col, ci) => (
                <th key={ci}>
                  <input
                    className="form-input"
                    type="text"
                    value={col}
                    onChange={e => onChange({ columns: head.map((c, i) => (i === ci ? e.target.value : c)) })}
                    placeholder={`Kolumn ${ci + 1}`}
                  />
                  <button
                    type="button"
                    className="tap-source-remove"
                    disabled={width < 2}
                    onClick={() => onChange({
                      columns: head.filter((_, i) => i !== ci),
                      cells: body.map(row => row.filter((_, i) => i !== ci)),
                    })}
                    aria-label={`Ta bort kolumn ${ci + 1}`}
                  >✕</button>
                </th>
              ))}
              <th className="tap-table-gutter" />
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      className="form-input"
                      type="text"
                      value={cell}
                      onChange={e => onChange({
                        cells: body.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? e.target.value : c)) : r)),
                      })}
                    />
                  </td>
                ))}
                <td className="tap-table-gutter">
                  <button
                    type="button"
                    className="tap-source-remove"
                    onClick={() => onChange({ cells: body.filter((_, i) => i !== ri) })}
                    aria-label={`Ta bort rad ${ri + 1}`}
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tap-table-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ cells: [...body, Array.from({ length: width }, () => '')] })}>+ Rad</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ columns: [...head, ''], cells: body.map(row => [...row, '']) })}>+ Kolumn</button>
      </div>
    </div>
  )
}

/**
 * Visar vad adressen kommer att göra. Det är hela poängen med att bara ha en
 * knapptyp: redaktören väljer inte "intern" eller "extern", utan ser här vad
 * det som skrivits in blev.
 */
function LinkNote({ url }: { url: string }) {
  if (!url.trim()) {
    return <p className="form-hint">Ingen länk vald ännu — klistra in en adress, välj ett dokument eller ladda upp en fil.</p>
  }
  const path = internalPath(url)
  if (path) return <p className="form-hint">Sida på webbplatsen ({path}) — öppnas direkt, utan nytt fönster.</p>
  const normalized = normalizeUrl(url)
  return (
    <p className="form-hint">
      Extern länk — öppnas automatiskt i ett nytt fönster.
      {normalized !== url.trim() && <> Adressen sparas som <code>{normalized}</code>.</>}
    </p>
  )
}

// Alt+<letter> quick-inserts a block (or, for text styles, applies the style),
// so you rarely need to reach for the toolbar. Letters follow the Swedish label
// where it doesn't clash (Faktaruta→F, Varningsruta→V, Uppmaning→U …); Video
// falls back to the "I" in vIdeo since V is taken. The letter is shown on each
// toolbar button so it stays discoverable.
const SHORTCUT_KEY: Partial<Record<ContentBlock['type'], string>> = {
  paragraph: 'T', heading: 'R', quote: 'C',
  image: 'B', factbox: 'F', warning: 'V', list: 'L',
  cta: 'U', video: 'I', button: 'K', links: 'N', table: 'E', comparison: 'J', sources: 'S', divider: 'A',
}
// e.code (layout-independent, avoids AltGr special chars) → block type.
const CODE_TO_TYPE = Object.fromEntries(
  Object.entries(SHORTCUT_KEY).map(([type, key]) => ['Key' + key, type as ContentBlock['type']]),
) as Record<string, ContentBlock['type'] | undefined>

function blankBlock(type: ContentBlock['type']): ContentBlock {
  const b: ContentBlock = { type }
  if (type === 'paragraph' || type === 'heading' || type === 'quote') b.text = ''
  if (type === 'factbox' || type === 'warning') { b.title = ''; b.text = '' }
  if (type === 'image') { b.image_url = ''; b.alt_text = ''; b.text = '' }
  if (type === 'video') { b.video_url = ''; b.title = '' }
  if (type === 'button') { b.text = ''; b.url = '' }
  if (type === 'sources') { b.sources = [] }
  if (type === 'list') { b.title = ''; b.items = [''] }
  if (type === 'cta' || type === 'links') { b.title = ''; b.links = [] }
  if (type === 'comparison') { b.title = ''; b.rows = [] }
  if (type === 'table') { b.title = ''; b.columns = ['', '']; b.cells = [['', '']] }
  return b
}

// Hjälpen i MD-läget. Håll den i takt med src/lib/markdownBlocks.ts.
const MD_CHEATSHEET = `# Rubrik 1 … ###### Rubrik 6
## Rubrik ##               (avslutande # går också bra)
Rubrik                     (understruken rubrik: = ger nivå 1,
======                      - ger nivå 2)

Brödtext. Tom rad ger ett nytt stycke.
> Citat                     (tom >-rad ger nytt stycke
>                            i citatet)
- Punkt i lista
| Kolumn | Kolumn |         (tabell – raden under
| --- | --- |                måste vara streck)
| Cell | Cell |
---                        (avdelare)
![alt](bildadress "bildtext")
[Knapptext](https://…)     (ensam på raden = knapp)

:::fakta Rubrik            (faktaruta)
Texten i rutan.
:::

:::varning Rubrik          (varningsruta)
:::lista Rubrik            (punktlista med rubrik)
:::video Rubrik            (videolänken på egen rad)
:::uppmaning Rubrik        (knappar som - [text](länk))
:::länkar Rubrik           (länklista som - [text](länk))
:::tabell Rubrik           (tabell med rubrik över)
:::jämförelse Rubrik       (rader som - Etikett: Värde)
:::källor                  (källor som - [text](länk))`

/** "Yttrande NCC 2024.pdf" → "Yttrande NCC 2024", som förslag på knapptext. */
const fileTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || name

/**
 * Texten ett block faktiskt visar, som en sträng — underlaget när innehållet
 * ska följa med till en annan typ. Bara fälten den aktuella typen använder
 * läses, annars skulle ett stycke som blivit punktlista och sedan stycke igen
 * få texten två gånger (den ligger kvar i både text och items).
 */
function blockText(block: ContentBlock): string {
  const parts: (string | undefined)[] = [block.title]
  if (block.type === 'list') parts.push(...(block.items ?? []))
  else if (block.type === 'cta' || block.type === 'links') parts.push(...(block.links ?? []).map(l => l.label))
  else parts.push(block.text)
  return parts.filter(part => part?.trim()).join('\n')
}

/**
 * Byter typ på ett block utan att skriva om innehållet. Fälten följer med som
 * de är — ett block är en påse med valfria fält, och den nya typen visar dem
 * den känner igen — men texten flyttas dit den nya typen faktiskt läser den, så
 * att ett stycke som blir en punktlista inte hamnar tomt.
 */
function convertBlock(block: ContentBlock, type: ContentBlock['type']): ContentBlock {
  if (block.type === type) return block
  const next: ContentBlock = { ...blankBlock(type), ...block, type }
  const text = blockText(block)

  if (isText(type)) next.text = text
  if (type === 'factbox' || type === 'warning') next.text = block.text?.trim() ? block.text : text
  if (type === 'button' && !block.text?.trim()) next.text = text.split('\n')[0] ?? ''
  if (type === 'list' && !block.items?.length) next.items = text ? text.split('\n') : ['']
  if (type === 'table' && !block.cells?.length) {
    next.cells = text ? text.split('\n').map(row => [row, '']) : [['', '']]
  }
  return next
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

interface Props {
  blocks: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
}

export default function TapEditor({ blocks, onChange }: Props) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  const [focused, setFocused] = useState<number | null>(null)
  const [pending, setPending] = useState<{ index: number; caret: number } | null>(null)
  // Blocket vars länk uppladdningsrutan fyller i, null när rutan är stängd.
  const [uploadFor, setUploadFor] = useState<number | null>(null)
  // Detsamma för bildväljaren.
  const [mediaFor, setMediaFor] = useState<number | null>(null)
  // Markdown-läget: texten redigeras här och tolkas till block för varje
  // tangenttryck, så att ett byte tillbaka till Vanlig visar samma innehåll.
  // null = vanligt läge.
  const [markdown, setMarkdown] = useState<string | null>(null)
  const mdRef = useRef<HTMLTextAreaElement>(null)
  // Markörens plats efter att ett verktyg skrivit in något i MD-rutan.
  const [mdCaret, setMdCaret] = useState<number | null>(null)
  const [pdfImport, setPdfImport] = useState(false)
  const { show } = useToast()
  const documents = usePublishedDocuments()

  // Ensure there is always something to type into.
  const list = blocks.length ? blocks : [{ type: 'paragraph' as const, text: '' }]

  useLayoutEffect(() => {
    refs.current.forEach(autosize)
  })

  useLayoutEffect(() => {
    if (!pending) return
    const el = refs.current[pending.index]
    if (el) {
      el.focus()
      const c = Math.min(pending.caret, el.value.length)
      el.setSelectionRange(c, c)
      autosize(el)
    }
    setPending(null)
  }, [pending])

  useLayoutEffect(() => {
    if (mdCaret == null) return
    const el = mdRef.current
    if (el) {
      el.focus()
      const c = Math.min(mdCaret, el.value.length)
      el.setSelectionRange(c, c)
    }
    setMdCaret(null)
  }, [mdCaret])

  function commit(next: ContentBlock[]) {
    onChange(next.length ? next : [{ type: 'paragraph', text: '' }])
  }
  function set(index: number, updates: Partial<ContentBlock>) {
    commit(list.map((b, i) => (i === index ? { ...b, ...updates } : b)))
  }
  function setType(index: number, type: ContentBlock['type'], extra?: Partial<ContentBlock>) {
    commit(list.map((b, i) => (i === index ? { ...b, type, ...extra } : b)))
    setPending({ index, caret: (list[index].text ?? '').length })
  }
  function removeAt(index: number) {
    commit(list.filter((_, i) => i !== index))
    setPending({ index: Math.max(0, index - 1), caret: 99999 })
  }
  function moveAt(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }
  function insertAfter(index: number | null, type: ContentBlock['type'], extra?: Partial<ContentBlock>) {
    const block = { ...blankBlock(type), ...extra }
    // Står man på en tom rad ska blocket hamna där, inte under den — annars
    // blir en tom rad kvar ovanför allt man lägger till.
    const onBlankLine = index != null && isText(list[index]?.type) && !list[index].text?.trim()
    const at = index == null ? list.length : onBlankLine ? index : index + 1
    commit([...list.slice(0, at), block, ...list.slice(onBlankLine ? at + 1 : at)])
    if (isText(type)) setPending({ index: at, caret: 0 })
  }
  // The text-style buttons double as a way to "break free" from an element
  // block: with a text line focused they convert it, but with an element
  // (bild, faktaruta, …) focused — or nothing focused — they add a fresh text
  // line after it so you can keep writing freely.
  function applyText(type: TextType, extra?: Partial<ContentBlock>) {
    if (markdown != null) {
      insertMarkdown(type === 'heading' ? headingSnippet(headingLevel(extra?.level)) : MD_SNIPPET[type] ?? '{}')
      return
    }
    if (focused != null && isText(list[focused].type)) setType(focused, type, extra)
    else insertAfter(focused, type, extra)
  }
  /** Rubrikval ur popovern eller Ctrl+Shift+1…6 — nivåerna är markdownens # … ######. */
  function applyHeading(level: number) {
    applyText('heading', { level })
  }
  // Verktygsraden och kortkommandona gör samma sak i båda lägena: i Vanlig
  // läggs blocket in, i MD skrivs dess markdown in vid markören.
  function addBlock(type: ContentBlock['type']) {
    if (markdown != null) insertMarkdown(MD_SNIPPET[type] ?? '{}')
    else insertAfter(focused, type)
  }

  /**
   * Skriver in text vid markören i MD-rutan, alltid som ett eget block med tom
   * rad omkring, och lämnar markören `caretOffset` tecken in i det som lades in.
   */
  function insertAtCaret(snippet: string, caretOffset: number) {
    const text = markdown ?? ''
    const at = mdRef.current?.selectionStart ?? text.length
    const before = text.slice(0, at).replace(/\s+$/, '')
    const after = text.slice(at).replace(/^\s+/, '')
    const head = before ? before + '\n\n' : ''
    editMarkdown(head + snippet + (after ? '\n\n' + after : '\n'))
    setMdCaret(head.length + caretOffset)
  }
  /** Verktygsradens mallar, där {} markerar var markören ska hamna. */
  function insertMarkdown(template: string) {
    const caret = template.indexOf('{}')
    const snippet = template.replace('{}', '')
    insertAtCaret(snippet, caret < 0 ? snippet.length : caret)
  }

  /**
   * Står markören mitt i blocket? Då byter kortkommandot typ på blocket i
   * stället för att lägga till ett nytt. I slutet av raden — eller på en tom
   * rad — är det ett nytt block man är ute efter. I en ruta (bild, faktaruta …)
   * finns inget "slut" att stå i, så där gäller alltid byte.
   */
  function caretInside(index: number): boolean {
    const block = list[index]
    if (!block) return false
    if (!isText(block.type)) return true
    const el = refs.current[index]
    if (!el || document.activeElement !== el) return false
    return el.value.length > 0 && el.selectionEnd < el.value.length
  }

  /** Byter typ på ett block och låter markören stå kvar där den stod. */
  function convertAt(index: number, type: ContentBlock['type']) {
    const caret = refs.current[index]?.selectionEnd
    commit(list.map((b, i) => (i === index ? convertBlock(b, type) : b)))
    if (isText(type)) setPending({ index, caret: caret ?? (list[index].text ?? '').length })
  }

  // MD-läget: på väg in skrivs blocken ut som text, och varje ändring tolkas
  // direkt tillbaka till block. Vägen ut behöver därför inget eget steg — det
  // som står i rutan är redan sparat som block.
  function enterMarkdown() {
    refs.current = []
    setFocused(null)
    setMarkdown(blocksToMarkdown(list))
  }
  function editMarkdown(text: string) {
    setMarkdown(text)
    commit(markdownToBlocks(text))
  }

  // Ctrl+Alt+<letter> anywhere in the editor quick-inserts the matching block
  // after the focused one (or applies the style, for text). Uses e.code so it's
  // layout-independent. Note: on Nordic keyboards AltGr sends Ctrl+Alt, but the
  // chosen letters don't produce AltGr characters on those layouts, so typing is
  // unaffected.
  function onEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Ctrl+Shift+1…6 sätter rubriknivå. Siffrorna kan inte ligga på Ctrl+Alt:
    // det är AltGr på svenskt tangentbord och skriver @, £, $ …
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      const digit = /^(?:Digit|Numpad)([1-6])$/.exec(e.code)
      if (digit) {
        e.preventDefault()
        applyHeading(Number(digit[1]))
        return
      }
    }
    if (!e.altKey || !e.ctrlKey || e.metaKey) return
    const type = CODE_TO_TYPE[e.code]
    if (!type) return
    e.preventDefault()
    // Mitt i ett block byter kommandot typ på blocket och behåller innehållet.
    // I slutet av det, eller på en tom rad, lägger det till ett nytt.
    if (markdown == null && focused != null && caretInside(focused)) convertAt(focused, type)
    else if (isText(type)) applyText(type)
    else addBlock(type)
  }

  /**
   * Skriver man "## " först på en rad blir raden en rubrik på den nivån, precis
   * som i MD-läget. Returnerar true när raden togs om hand.
   */
  function autoHeading(index: number, value: string): boolean {
    const m = /^(#{1,6}) ([^]*)$/.exec(value)
    if (!m || !isText(list[index].type)) return false
    commit(list.map((b, i) => (i === index ? { ...b, type: 'heading', level: m[1].length, text: m[2] } : b)))
    setPending({ index, caret: 0 })
    return true
  }

  function onTextKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const el = e.currentTarget
    if (e.key === 'Enter' && e.shiftKey && list[index].type === 'quote') {
      // Skift+Enter delar citatet i stycken. Det skrivs in som en tom rad, samma
      // form som markdown använder och som sidan visar som nytt stycke — en
      // ensam radbrytning skulle rinna ihop igen när citatet renderas.
      e.preventDefault()
      const caret = el.selectionStart
      set(index, { text: el.value.slice(0, caret) + '\n\n' + el.value.slice(el.selectionEnd) })
      setPending({ index, caret: caret + 2 })
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const caret = el.selectionStart
      const before = el.value.slice(0, caret)
      const after = el.value.slice(caret)
      const next = [...list]
      next[index] = { ...list[index], text: before }
      next.splice(index + 1, 0, { type: 'paragraph', text: after })
      commit(next)
      setPending({ index: index + 1, caret: 0 })
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (index === 0) return
      const prev = list[index - 1]
      if (!isText(prev.type)) return
      e.preventDefault()
      const prevText = prev.text ?? ''
      const next = [...list]
      next[index - 1] = { ...prev, text: prevText + (list[index].text ?? '') }
      next.splice(index, 1)
      commit(next)
      setPending({ index: index - 1, caret: prevText.length })
    }
  }

  const focusedIsText = focused != null && list[focused] && isText(list[focused].type)
  const focusedType = focusedIsText ? list[focused!].type : null
  const focusedLevel = focusedType === 'heading' ? headingLevel(list[focused!].level) : null

  const placeholder = (block: ContentBlock, index: number) =>
    block.type === 'heading' ? `Rubrik ${headingLevel(block.level)}`
      : block.type === 'quote' ? 'Citat…'
        : index === 0 ? 'Börja skriva…' : 'Skriv här…'

  return (
    <div className="tap-editor" onKeyDown={onEditorKeyDown}>
      <div className="tap-toolbar">
        <div className="tap-mode-switch" role="group" aria-label="Redigeringsläge">
          <button type="button" className={markdown == null ? 'tap-mode active' : 'tap-mode'} title="Vanlig editor – ett block i taget" onMouseDown={e => e.preventDefault()} onClick={() => setMarkdown(null)}>Vanlig</button>
          <button type="button" className={markdown != null ? 'tap-mode active' : 'tap-mode'} title="Markdown – hela innehållet som text" onMouseDown={e => e.preventDefault()} onClick={enterMarkdown}>MD</button>
        </div>
        <span className="tap-toolbar-sep" />
        <div className="tap-toolbar-group">
          <button type="button" title="Text (Ctrl+Alt+T)" className={focusedType === 'paragraph' ? 'tap-tool active' : 'tap-tool'} onMouseDown={e => e.preventDefault()} onClick={() => applyText('paragraph')}>Text</button>
          <HeadingMenu level={focusedLevel} onPick={applyHeading} />
          <button type="button" title="Citat (Ctrl+Alt+C)" className={focusedType === 'quote' ? 'tap-tool active' : 'tap-tool'} onMouseDown={e => e.preventDefault()} onClick={() => applyText('quote')}>Citat</button>
        </div>
        <span className="tap-toolbar-sep" />
        <div className="tap-toolbar-group">
          {INSERTS.map(ins => (
            <button key={ins.type} type="button" title={`${ins.label} (Ctrl+Alt+${SHORTCUT_KEY[ins.type]})`} className="tap-tool tap-tool-insert" onMouseDown={e => e.preventDefault()} onClick={() => addBlock(ins.type)}>
              + {ins.label} <span className="tap-tool-key">{SHORTCUT_KEY[ins.type]}</span>
            </button>
          ))}
        </div>
      </div>

      {markdown != null && (
        <div className="tap-md-pane">
          <div className="tap-md-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPdfImport(true)}>
              Hämta text från PDF…
            </button>
            <span className="form-hint">Rubriker, stycken och listor följer med som block.</span>
          </div>
          <textarea
            ref={mdRef}
            className="tap-md"
            value={markdown}
            onChange={e => editMarkdown(e.target.value)}
            placeholder={'Klistra in eller skriv markdown här…\n\n## Rubrik\nBrödtext.\n\n- Punkt\n- Punkt'}
            spellCheck={false}
            autoFocus
          />
          <details className="tap-md-help">
            <summary>Så skrivs blocken</summary>
            <pre>{MD_CHEATSHEET}</pre>
          </details>
        </div>
      )}

      {markdown == null && (
      <div className="tap-doc">
        {list.map((block, i) => (
          <div className="tap-block" key={i}>
            <div className="tap-block-ctrls">
              <button type="button" onClick={() => moveAt(i, -1)} disabled={i === 0} aria-label="Flytta upp">↑</button>
              <button type="button" onClick={() => moveAt(i, 1)} disabled={i === list.length - 1} aria-label="Flytta ner">↓</button>
              <button type="button" className="danger" onClick={() => removeAt(i)} aria-label="Ta bort">✕</button>
            </div>

            {isText(block.type) ? (
              <textarea
                ref={el => { refs.current[i] = el }}
                className={`tap-text tap-${block.type}${block.type === 'heading' ? ` tap-h${headingLevel(block.level)}` : ''}`}
                value={block.text ?? ''}
                rows={1}
                placeholder={placeholder(block, i)}
                onFocus={() => setFocused(i)}
                onChange={e => {
                  if (autoHeading(i, e.target.value)) return
                  set(i, { text: e.target.value })
                  autosize(e.target)
                }}
                onKeyDown={e => onTextKeyDown(e, i)}
              />
            ) : (
              <div className="tap-element" onFocus={() => setFocused(i)}>
                <span className="tap-element-tag">{blockLabel(block.type)}</span>

                {block.type === 'divider' && <hr className="tap-divider" />}

                {(block.type === 'factbox' || block.type === 'warning') && (
                  <>
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik" />
                    <textarea className="form-textarea" rows={3} value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Text" />
                  </>
                )}

                {block.type === 'image' && (
                  <>
                    <div className="tap-link-row">
                      <input className="form-input" type="url" value={block.image_url ?? ''} onChange={e => set(i, { image_url: e.target.value })} placeholder="Klistra in bildadress (URL)" />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMediaFor(i)}>Välj bild…</button>
                    </div>
                    <input className="form-input" type="text" value={block.alt_text ?? ''} onChange={e => set(i, { alt_text: e.target.value })} placeholder="Beskriv bilden (alt-text)" />
                    <input className="form-input" type="text" value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Bildtext (valfritt)" />
                    {block.image_url && <img src={block.image_url} alt="" className="tap-image-preview" />}
                  </>
                )}

                {block.type === 'video' && (
                  <>
                    <input className="form-input" type="url" value={block.video_url ?? ''} onChange={e => set(i, { video_url: e.target.value })} placeholder="Video-länk (YouTube/Vimeo embed)" />
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Titel (valfritt)" />
                  </>
                )}

                {block.type === 'button' && (
                  <>
                    <input className="form-input" type="text" value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Knapptext" />
                    <div className="tap-link-row">
                      <input
                        className="form-input"
                        type="text"
                        value={block.url ?? ''}
                        onChange={e => set(i, { url: e.target.value })}
                        onBlur={e => { const n = normalizeUrl(e.target.value); if (n !== e.target.value) set(i, { url: n }) }}
                        placeholder="Länk – webbadress eller /sida på webbplatsen"
                      />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUploadFor(i)}>Ladda upp fil…</button>
                    </div>
                    <LinkNote url={block.url ?? ''} />
                    <DocumentPicker
                      docs={documents}
                      url={block.url ?? ''}
                      onPick={doc => set(i, { url: documentUrl(doc), text: block.text || doc.title })}
                    />
                  </>
                )}

                {block.type === 'resource' && (
                  <>
                    <p className="form-hint">
                      Den här rutan ersätts av <strong>Knapp</strong>, som blir extern av sig själv när adressen är det.
                      Den befintliga rutan går att redigera vidare, men nya lägger du till som knapp.
                    </p>
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik – t.ex. Enkät om Rögleskogen" />
                    <textarea className="form-textarea" rows={2} value={block.text ?? ''} onChange={e => set(i, { text: e.target.value })} placeholder="Kort beskrivning (valfritt)" />
                    <input className="form-input" type="url" value={block.url ?? ''} onChange={e => set(i, { url: e.target.value })} placeholder="Länk (URL) – öppnas i nytt fönster" />
                    <input className="form-input" type="text" value={block.button_label ?? ''} onChange={e => set(i, { button_label: e.target.value })} placeholder="Knapptext (valfritt, standard: ”Öppna”)" />
                    <DocumentPicker
                      docs={documents}
                      url={block.url ?? ''}
                      onPick={doc => set(i, {
                        url: documentUrl(doc),
                        title: block.title || doc.title,
                        text: block.text || doc.description || '',
                      })}
                    />
                  </>
                )}

                {block.type === 'list' && (
                  <div className="tap-sources">
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik (valfritt)" />
                    {(block.items ?? []).map((it, li) => (
                      <div key={li} className="tap-source-row">
                        <input className="form-input" type="text" value={it} onChange={e => {
                          const items = [...(block.items ?? [])]; items[li] = e.target.value; set(i, { items })
                        }} placeholder="Punkt" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { items: (block.items ?? []).filter((_, j) => j !== li) })} aria-label="Ta bort punkt">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { items: [...(block.items ?? []), ''] })}>+ Lägg till punkt</button>
                  </div>
                )}

                {block.type === 'table' && (
                  <TableEditor block={block} onChange={updates => set(i, updates)} />
                )}

                {block.type === 'comparison' && (
                  <div className="tap-sources">
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder="Rubrik (valfritt)" />
                    {(block.rows ?? []).map((row, ri) => (
                      <div key={ri} className="tap-source-row">
                        <input className="form-input" type="text" value={row.label} onChange={e => {
                          const rows = [...(block.rows ?? [])]; rows[ri] = { ...rows[ri], label: e.target.value }; set(i, { rows })
                        }} placeholder="Etikett – t.ex. Avstånd till bostad" />
                        <input className="form-input" type="text" value={row.value} onChange={e => {
                          const rows = [...(block.rows ?? [])]; rows[ri] = { ...rows[ri], value: e.target.value }; set(i, { rows })
                        }} placeholder="Värde – t.ex. 400 meter" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { rows: (block.rows ?? []).filter((_, j) => j !== ri) })} aria-label="Ta bort rad">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { rows: [...(block.rows ?? []), { label: '', value: '' }] })}>+ Lägg till rad</button>
                  </div>
                )}

                {(block.type === 'cta' || block.type === 'links') && (
                  <div className="tap-sources">
                    <input className="form-input" type="text" value={block.title ?? ''} onChange={e => set(i, { title: e.target.value })} placeholder={block.type === 'links' ? 'Rubrik (valfritt, standard: ”Relaterade länkar”)' : 'Rubrik (valfritt)'} />
                    {(block.links ?? []).map((lnk, li) => (
                      <div key={li} className="tap-source-row">
                        <input className="form-input" type="text" value={lnk.label} onChange={e => {
                          const links = [...(block.links ?? [])]; links[li] = { ...links[li], label: e.target.value }; set(i, { links })
                        }} placeholder="Knapptext" />
                        <input className="form-input" type="text" value={lnk.url} onChange={e => {
                          const links = [...(block.links ?? [])]; links[li] = { ...links[li], url: e.target.value }; set(i, { links })
                        }} placeholder="Länk (URL eller /sida)" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { links: (block.links ?? []).filter((_, j) => j !== li) })} aria-label="Ta bort knapp">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { links: [...(block.links ?? []), { label: '', url: '' }] })}>+ Lägg till knapp</button>
                  </div>
                )}

                {block.type === 'sources' && (
                  <div className="tap-sources">
                    {(block.sources ?? []).map((src, si) => (
                      <div key={si} className="tap-source-row">
                        <input className="form-input" type="text" value={src.label} onChange={e => {
                          const sources = [...(block.sources ?? [])]; sources[si] = { ...sources[si], label: e.target.value }; set(i, { sources })
                        }} placeholder="Källnamn" />
                        <input className="form-input" type="url" value={src.url} onChange={e => {
                          const sources = [...(block.sources ?? [])]; sources[si] = { ...sources[si], url: e.target.value }; set(i, { sources })
                        }} placeholder="URL" />
                        <button type="button" className="tap-source-remove" onClick={() => set(i, { sources: (block.sources ?? []).filter((_, j) => j !== si) })} aria-label="Ta bort källa">✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(i, { sources: [...(block.sources ?? []), { label: '', url: '' }] })}>+ Lägg till källa</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {pdfImport && (
        <PdfImportDialog
          onClose={() => setPdfImport(false)}
          onImported={(md, fileName) => {
            setPdfImport(false)
            if (!md) return
            insertAtCaret(md, md.length)
            // Säg vad som hittades — går rubrikerna förlorade syns det direkt,
            // i stället för att man får leta i texten efter varför.
            const added = markdownToBlocks(md)
            const headings = added.filter(b => b.type === 'heading').length
            const lists = added.filter(b => b.type === 'list').length
            show(
              `${fileName}: ${added.length} block, varav ${headings} rubriker och ${lists} listor`,
              headings > 0 ? 'success' : 'info',
            )
          }}
        />
      )}

      {mediaFor != null && (
        <MediaPicker
          onClose={() => setMediaFor(null)}
          onPick={media => {
            // Alt-texten från biblioteket skriver inte över en egen beskrivning.
            set(mediaFor, {
              image_url: media.url,
              alt_text: list[mediaFor].alt_text?.trim() ? list[mediaFor].alt_text : media.alt,
            })
            setMediaFor(null)
          }}
        />
      )}

      {uploadFor != null && (
        <UploadDialog
          title="Ladda upp fil till knappen"
          onClose={() => setUploadFor(null)}
          onUploaded={(url, file) => set(uploadFor, { url, text: list[uploadFor].text || fileTitle(file.name) })}
        />
      )}

      {markdown != null ? (
        <p className="tap-hint">
          Allt du skriver här blir block direkt — byt till <strong>Vanlig</strong> när du vill se resultatet.
          Knapparna i verktygsraden och <kbd>Ctrl</kbd>+<kbd>Alt</kbd>-kommandona fungerar även här: de skriver in blockets markdown vid markören.
          Innehåll som inte finns i vanlig markdown (faktarutor, videor, uppmaningar …) står som <code>:::</code>-block och följer med tillbaka oförändrat.
        </p>
      ) : (
      <p className="tap-hint">Klicka och skriv. Tryck <kbd>Enter</kbd> för ny rad. I ett citat ger <kbd>Skift</kbd>+<kbd>Enter</kbd> ett nytt stycke inuti citatet. Markera en rad och tryck <strong>Rubrik</strong> (nivå 1–6 i listan, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>6</kbd>, eller <code>##</code> först på raden) eller <strong>Citat</strong> för att ändra stil. Står du i en ruta (bild, faktaruta …) kan du trycka <strong>Text</strong>, <strong>Rubrik</strong> eller <strong>Citat</strong> för att fortsätta skriva under den. Håll <kbd>Ctrl</kbd>+<kbd>Alt</kbd> och tryck bokstaven på en knapp: står du <strong>mitt i</strong> ett block byter det typ på blocket med innehållet kvar, står du i slutet av raden eller på en tom rad läggs blocket till.</p>
      )}
    </div>
  )
}
