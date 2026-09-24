import { useEffect } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Blobatar } from '@blobatar/react'
import { useGaze } from '@blobatar/react/gaze'
import type { Expression } from 'blobatar/expression'
import { User } from 'lucide-react'
import { caretAt } from '../lib/caretGaze'
import { useBlobAvatarsEnabled } from '../lib/blobSettings'
import { hueForSeed, NATURE_SHAPES } from '../lib/blobPalette'
import 'blobatar/motion.css'
import 'blobatar/gaze.css'

// Delad avatar-komponent (Blobatar, github.com/blobatar): en sträng ger
// alltid samma deterministiska "blob"-figur, och byts strängen (t.ex. medan
// någon skriver) uppdateras figuren direkt — inget sparas, inget hämtas.
// Används som avatar i adminpanelen, intranätet och registreringsflödet.
//
// `seed` är oftast e-postadressen (samma figur överallt en person syns), men
// kan bytas mot valfri text för att avataren ska reagera på det man skriver
// (registrering, lösenordsbyte).
export default function UserAvatar({
  seed,
  size = 32,
  animate,
  gaze,
  caretOf,
  revealed,
  expression,
  className,
  style,
  title,
}: {
  seed: string
  size?: number
  /** "hover" = rör sig vid hover (listor), "always" = rör sig hela tiden (framträdande enstaka avatar). Utelämnad = stillbild. */
  animate?: 'hover' | 'always'
  /** Ögonen/huvudet följer muspekaren (som notisklockans avatar). Tvingar fram animate="always". */
  gaze?: boolean
  /**
   * Ögonen följer insättningspunkten i det här fältet medan det har fokus,
   * annars muspekaren (som `gaze`, och gör den överflödig). För t.ex.
   * inloggningens lösenordsfält, där en hel PasswordField är överkurs.
   */
  caretOf?: RefObject<HTMLInputElement | null>
  /**
   * Med `caretOf`: lösenordet visas i klartext just nu, så figuren ska INTE
   * titta på vad som skrivs — blicken går till vila i stället för att följa
   * insättningspunkten. Samma idé som PasswordField.tsx, fast för en avatar
   * kopplad till ett fält den inte själv äger.
   */
  revealed?: boolean
  /** En låst pose, t.ex. `thinking` från `blobatar/expression`. Tvingar fram animate="always" (posen morphar annars inte fram). */
  expression?: Expression
  className?: string
  style?: CSSProperties
  title?: string
}) {
  // En tom sträng ger fortfarande en figur (blobatar hashar allt), men en
  // stabil platshållarsträng är trevligare än att avataren hoppar till en
  // slumpmässig figur innan något är ifyllt.
  const name = seed.trim() || 'ny-anvandare'
  const blobsEnabled = useBlobAvatarsEnabled()
  const active = gaze || !!caretOf
  const { ref: gazeRef, lookAt } = useGaze({
    travel: caretOf ? 16 : 2,
    // Utelämnad (inte 'pointer') när caretOf finns: den siktar själv nedan,
    // och en deklarativ lookAt skulle skriva över det på varje omritning.
    lookAt: caretOf ? undefined : 'pointer',
  })

  // Följer insättningspunkten i ett fält utanför denna komponent (t.ex.
  // inloggningens lösenordsfält) medan det har fokus, annars muspekaren.
  useEffect(() => {
    const el = caretOf?.current
    if (!el) return
    const aim = () => {
      if (revealed) { lookAt('rest'); return }
      if (document.activeElement === el) {
        const at = caretAt(el)
        if (at) { lookAt(at); return }
      }
      lookAt('pointer')
    }
    el.addEventListener('focus', aim)
    el.addEventListener('blur', aim)
    el.addEventListener('input', aim)
    el.addEventListener('keyup', aim)
    el.addEventListener('click', aim)
    el.addEventListener('select', aim)
    window.addEventListener('scroll', aim, { passive: true, capture: true })
    window.addEventListener('resize', aim, { passive: true })
    aim()
    return () => {
      el.removeEventListener('focus', aim)
      el.removeEventListener('blur', aim)
      el.removeEventListener('input', aim)
      el.removeEventListener('keyup', aim)
      el.removeEventListener('click', aim)
      el.removeEventListener('select', aim)
      window.removeEventListener('scroll', aim, { capture: true })
      window.removeEventListener('resize', aim)
    }
  }, [caretOf, revealed, lookAt])

  // Avstängt i inställningarna för den här delen av sajten: en neutral,
  // icke-personifierad platshållare i stället för blobben.
  if (!blobsEnabled) {
    return (
      <span
        className={className}
        data-tooltip={title}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: 'var(--bg-alt)', color: 'var(--text-muted)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          ...style,
        }}
      >
        <User size={Math.round(size * 0.55)} aria-hidden="true" />
      </span>
    )
  }

  // `title` går ändå till Blobatar: den blir en <title> INUTI SVG:n (namnger
  // den för skärmläsare — se blobatar/src/react.tsx), inte bara en tooltip,
  // så den behövs kvar av tillgänglighetsskäl. `data-tooltip` känner
  // Blobatar inte igen och hamnar därför direkt på samma rot-element
  // (spreadas via `...rest`) — den egna, temaanpassade tooltipen hinner
  // synas långt innan webbläsarens inbyggda SVG-title-tooltip ens dyker upp.
  return (
    <Blobatar
      ref={active ? gazeRef : undefined}
      name={name}
      size={size}
      background="circle"
      hue={hueForSeed(name)}
      traits={{ shape: NATURE_SHAPES }}
      animate={active || expression ? 'always' : animate}
      expression={expression}
      title={title}
      data-tooltip={title}
      className={className}
      style={style}
    />
  )
}
