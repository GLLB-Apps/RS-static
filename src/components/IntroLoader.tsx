import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// First-visit intro: a white fullscreen while the logo draws + fills itself in
// the centre, then the finished mark flies to the header logo's position and the
// overlay fades to reveal the site. It is a welcome, not a page transition – it
// plays once for a new visitor and then stays out of the way until the memory of
// it has faded (see REPLAY_AFTER_MS). Skipped under prefers-reduced-motion and
// in the admin UI.
const DRAW_MS = 3600 // let the logo draw + fill itself
const MORPH_MS = 850 // fly to the header logo position
const FADE_MS = 450 // fade the white overlay away

const SEEN_KEY = 'ncc-rs:intro-seen' // value = timestamp (ms) of the last play
const REPLAY_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function introWasSeenRecently() {
  try {
    const seen = Number(window.localStorage.getItem(SEEN_KEY))
    return Number.isFinite(seen) && seen > 0 && Date.now() - seen < REPLAY_AFTER_MS
  } catch {
    // No storage (private mode, blocked cookies) – treat as seen rather than
    // replaying the intro on every single load.
    return true
  }
}

function markIntroSeen() {
  try { window.localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* ignore */ }
}

// One playthrough. Re-keyed to replay.
function IntroRun() {
  const [svg, setSvg] = useState('')
  const [morphing, setMorphing] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [done, setDone] = useState(false)
  const logoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Record it up front: a reload halfway through the animation still counts as
    // having been welcomed.
    markIntroSeen()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let cancelled = false
    const timers: number[] = []

    fetch('/loader/ncc_rs_logo_loader.svg')
      .then(r => r.text())
      .then(text => {
        if (cancelled) return
        setSvg(text)
        timers.push(window.setTimeout(() => {
          // Freeze the drawn logo (via the is-morphing class) and, on the next
          // frames, fly it onto the header logo image (FLIP).
          setMorphing(true)
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const el = logoRef.current
            const target = document.querySelector('.site-logo-badge .logo-img') as HTMLElement | null
            if (!cancelled && el && target) {
              const t = target.getBoundingClientRect()
              const l = el.getBoundingClientRect()
              if (t.height > 0 && l.height > 0) {
                const scale = t.height / l.height
                const dx = (t.left + t.width / 2) - (l.left + l.width / 2)
                const dy = (t.top + t.height / 2) - (l.top + l.height / 2)
                el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
              }
            }
          }))
          timers.push(window.setTimeout(() => {
            document.body.style.overflow = prevOverflow // let the revealed page scroll
            setHiding(true)
          }, MORPH_MS))
          timers.push(window.setTimeout(() => setDone(true), MORPH_MS + FADE_MS))
        }, DRAW_MS))
      })
      .catch(() => { if (!cancelled) { document.body.style.overflow = prevOverflow; setDone(true) } })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  if (done) return null

  return (
    <div className={`intro-loader${hiding ? ' is-hiding' : ''}`} aria-hidden="true">
      <div
        ref={logoRef}
        className={`intro-loader-logo${morphing ? ' is-morphing' : ''}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

export default function IntroLoader() {
  const location = useLocation()
  // Decided once, on the first render of the session: the intro is a greeting for
  // a new visitor, so it never re-triggers on navigation.
  const shouldPlay = useMemo(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    } catch { /* keep going – motion preference unknown */ }
    if (location.pathname.startsWith('/admin')) return false
    return !introWasSeenRecently()
  }, []) // deliberately not reacting to location changes

  if (!shouldPlay) return null
  return <IntroRun />
}
