// Var insättningspunkten sitter i sidkoordinater, för Blobatars ögon att
// sikta på. En <input> exponerar bara selectionStart som ett textoffset, inte
// geometri, så texten fram till dit läggs ut igen i en dold "spegel" med
// fältets eget typsnitt och mäts.
const MASK = '•'

export function caretAt(input: HTMLInputElement): { x: number; y: number } | null {
  const i = input.selectionStart
  if (i === null) return null

  const cs = getComputedStyle(input)
  const mirror = document.createElement('span')
  mirror.style.cssText = 'position:absolute;top:0;left:-9999px;visibility:hidden;white-space:pre'
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'textTransform'] as const) {
    mirror.style[p] = cs[p]
  }
  mirror.textContent = input.type === 'password' ? MASK.repeat(i) : input.value.slice(0, i)

  document.body.appendChild(mirror)
  const w = mirror.getBoundingClientRect().width
  mirror.remove()

  const r = input.getBoundingClientRect()
  const inset = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0)
  const stop = r.right - ((parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0))
  return {
    x: Math.min(Math.max(r.left + inset - input.scrollLeft + w, r.left + inset), stop),
    y: r.top + r.height / 2,
  }
}
