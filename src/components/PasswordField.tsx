import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Blobatar } from '@blobatar/react'
import type { BlobatarOptions } from 'blobatar'
import { useGaze } from '@blobatar/react/gaze'
import { sleepy } from 'blobatar/expression'
import { User } from 'lucide-react'
import { caretAt } from '../lib/caretGaze'
import { useBlobAvatarsEnabled } from '../lib/blobSettings'
import { hueForSeed } from '../lib/blobPalette'
import 'blobatar/motion.css'
import 'blobatar/gaze.css'

// Baserad på blobatar.dev:s registry-komponent "password-field", porterad
// från shadcn/Tailwind till projektets vanliga CSS-klasser (ingen Tailwind
// här). Figuren håller blicken på insättningspunkten medan fältet har fokus,
// och "somnar" (sleepy) när lösenordet visas i klartext.

export type PasswordFieldProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fröet till figuren — vanligtvis personens e-post. */
  name?: string
  size?: number
  blobatar?: BlobatarOptions
  label?: string
}

export default function PasswordField({
  name = 'ny-anvandare',
  size = 120,
  blobatar,
  label = 'Lösenord',
  value,
  defaultValue,
  onValueChange,
  onFocus,
  onBlur,
  id,
  className,
  ...props
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false)
  const [focused, setFocused] = useState(false)
  const [own, setOwn] = useState(defaultValue ?? '')
  const text = value ?? own
  const blobsEnabled = useBlobAvatarsEnabled()

  const { ref: face, lookAt } = useGaze({ travel: 16 })
  const input = useRef<HTMLInputElement>(null)
  const fieldId = id ?? 'blobatar-password'

  const aim = useCallback(() => {
    // Visat: blicken går till mitten och stannar där ("rest", inte null —
    // annars kommer den idlande blicken tillbaka och figuren ser ut att
    // slumpmässigt kika runt i rummet i stället för att medvetet titta bort).
    if (shown) { lookAt('rest'); return }
    if (focused && input.current) {
      const at = caretAt(input.current)
      if (at) { lookAt(at); return }
    }
    lookAt('pointer')
  }, [shown, focused, lookAt])

  useEffect(aim, [aim, text])

  useEffect(() => {
    if (!focused || shown) return
    const on = () => aim()
    addEventListener('scroll', on, { passive: true, capture: true })
    addEventListener('resize', on, { passive: true })
    return () => {
      removeEventListener('scroll', on, { capture: true })
      removeEventListener('resize', on)
    }
  }, [focused, shown, aim])

  const track = () => aim()

  return (
    <div className="blobatar-password-field">
      {blobsEnabled ? (
        <Blobatar
          ref={face}
          {...blobatar}
          name={name}
          size={size}
          background="circle"
          hue={blobatar?.hue ?? hueForSeed(name)}
          animate="always"
          expression={shown ? sleepy : blobatar?.expression}
        />
      ) : (
        <span
          style={{
            width: size, height: size, borderRadius: '50%',
            background: 'var(--bg-alt)', color: 'var(--text-muted)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <User size={Math.round(size * 0.55)} aria-hidden="true" />
        </span>
      )}
      <div className="form-group" style={{ width: '100%' }}>
        {label && <label className="form-label" htmlFor={fieldId}>{label}</label>}
        <div className="blobatar-password-field-input-wrap">
          <input
            ref={input}
            id={fieldId}
            className={className ? `form-input ${className}` : 'form-input'}
            type={shown ? 'text' : 'password'}
            autoComplete="new-password"
            value={text}
            onChange={e => {
              if (value === undefined) setOwn(e.target.value)
              onValueChange?.(e.target.value)
              track()
            }}
            onKeyUp={track}
            onClick={track}
            onSelect={track}
            onFocus={e => { setFocused(true); onFocus?.(e) }}
            onBlur={e => { setFocused(false); onBlur?.(e) }}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-pressed={shown}
            aria-label={shown ? 'Dölj lösenord' : 'Visa lösenord'}
            onClick={() => { setShown(s => !s); input.current?.focus() }}
            className="blobatar-password-field-toggle"
          >
            {shown ? 'Dölj' : 'Visa'}
          </button>
        </div>
        <p className="form-hint" aria-live="polite">
          {shown ? 'Tittar bort — lösenordet syns i klartext.' : 'Följer det du skriver.'}
        </p>
      </div>
    </div>
  )
}
