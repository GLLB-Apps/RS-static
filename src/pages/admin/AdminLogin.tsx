import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { apiFetch, ApiError } from '../../api/client'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { usernameFromEmail } from '../../lib/utils'
import { getRememberedAccount, rememberAccount } from '../../lib/lastAccount'
import MobileAdminNotice from '../../components/admin/MobileAdminNotice'
import UserAvatar from '../../components/UserAvatar'
import { thinking, sleepy } from 'blobatar/expression'
import { Eye, EyeOff } from 'lucide-react'

// Presentationen är obligatorisk vid registrering: den som tilldelar behörighet
// ska veta vem personen är innan de släpps in. Minimilängden hindrar "hej".
const INTRO_MIN = 40
const INTRO_MAX = 1000

export default function AdminLogin() {
  const { session, user, isAdmin, loading, displayName: accountName } = useAuth()
  const { show } = useToast()

  // Sparar undan kontot man loggar in med, så att rubriken kan hälsa med
  // namnet nästa gång — se lastAccount.ts. `loading` är klar här (rollen
  // och visningsnamnet är hämtade), så accountName har sitt slutgiltiga värde.
  useEffect(() => {
    if (session && !loading && user?.email) rememberAccount(user.email, accountName)
  }, [session, loading, user, accountName])

  const [remembered] = useState(getRememberedAccount)
  const [logo, setLogo] = useState('')
  useEffect(() => {
    let cancelled = false
    fetch('/site_logo/ncc_rs_logo.svg')
      .then(r => r.text())
      .then(t => { if (!cancelled) setLogo(t.slice(Math.max(0, t.indexOf('<svg')))) })
      .catch(() => { /* decorative only */ })
    return () => { cancelled = true }
  }, [])

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState(() => remembered?.email ?? '')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [intro, setIntro] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [loginShown, setLoginShown] = useState(false)
  const [signupShown, setSignupShown] = useState(false)
  const loginPasswordRef = useRef<HTMLInputElement>(null)

  if (loading) {
    return (
      <div className="admin-login-page admin-login-loading">
        <UserAvatar seed="rogleskogen" size={72} expression={thinking} title="Läser in…" />
      </div>
    )
  }
  // Admins till adminpanelen, alla andra inloggade till intranätet (guarden där
  // visar ett vänligt meddelande om kontot ännu inte fått medlemsåtkomst).
  if (session) return <Navigate to={isAdmin ? '/admin' : '/internt'} replace />

  // Känner webbläsaren igen adressen som skrivs (se lastAccount.ts) hälsar
  // rubriken med namnet i stället för den generiska texten — redan innan
  // man loggat in.
  const welcomeName = remembered && email.trim().toLowerCase() === remembered.email.toLowerCase()
    ? (remembered.displayName || usernameFromEmail(remembered.email))
    : null

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) show(error.message, 'error')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    if (intro.trim().length < INTRO_MIN) {
      show(`Skriv några rader om dig själv – minst ${INTRO_MIN} tecken`, 'error'); return
    }
    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setSubmitting(false)
      show(error.message, 'error')
      return
    }
    // insert, inte upsert: kontot har ännu ingen session efter registreringen,
    // och profiles tillåter bara gäster att *skapa* sin egen rad.
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName.trim(),
        intro: intro.trim(),
      })
      if (profileError) {
        setSubmitting(false)
        show('Kontot skapades, men presentationen kunde inte sparas: ' + profileError.message, 'error')
        return
      }
    }
    setSubmitting(false)
    setSignupDone(true)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Servern svarar alltid likadant oavsett om kontot finns — så UI:t kan
      // inte (och ska inte) skilja på fallen här heller.
      await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } })
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Kunde inte skicka återställningslänken.', 'error')
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    setForgotSent(true)
  }

  return (
    <div className="admin-login-page">
      <MobileAdminNotice />
      <div className="admin-login-split">
        <aside className="admin-login-brand">
          {logo && (
            <div className="admin-login-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo }} />
          )}
          <div className="admin-login-brand-inner">
            <span className="admin-login-eyebrow">Medborgarinitiativ</span>
            <h1 className="admin-login-brand-title">Rögleskogen</h1>
            <p className="admin-login-brand-text">
              Tillsammans bevakar och dokumenterar vi planerna för den föreslagna bergtäkten
              mellan Södra Sandby och Dalby.
            </p>
            <ul className="admin-login-brand-list">
              <li>Samla information, dokument och vittnesmål</li>
              <li>Håll boende och beslutsfattare uppdaterade</li>
              <li>Sakligt och källhänvisat – alltid</li>
            </ul>
          </div>
          <p className="admin-login-brand-foot">Adminpanel · endast för behöriga</p>
        </aside>

        <div className="admin-login-panel">
          {signupDone ? (
            <div className="admin-login-card" style={{ textAlign: 'center' }}>
              <div className="admin-login-check" aria-hidden="true">✓</div>
              <h2 className="admin-login-title">Konto skapat</h2>
              <p className="admin-login-subtitle">
                Tack! Ditt konto är registrerat. En administratör behöver tilldela dig en roll
                innan du kommer in i adminpanelen.
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setSignupDone(false); setMode('login') }}>
                Till inloggningen
              </button>
            </div>
          ) : (
            <div className="admin-login-card">
              <h2 className="admin-login-title">
                {mode === 'login'
                  ? (welcomeName ? <>Välkommen tillbaka, <strong>{welcomeName}</strong>!</> : 'Välkommen tillbaka')
                  : mode === 'signup' ? 'Skapa konto' : 'Glömt lösenordet'}
              </h2>
              {mode !== 'forgot' && (
                <p className="admin-login-subtitle">
                  {mode === 'login' ? 'Logga in för att hantera webbplatsen.' : 'Registrera dig – en administratör aktiverar ditt konto.'}
                </p>
              )}

              {mode !== 'forgot' && (
                <div className="admin-login-tabs">
                  <button
                    type="button"
                    className={mode === 'login' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => setMode('login')}
                  >
                    Logga in
                  </button>
                  <button
                    type="button"
                    className={mode === 'signup' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => setMode('signup')}
                  >
                    Skapa konto
                  </button>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="admin-login-avatar-preview">
                    <UserAvatar
                      seed={email}
                      size={88}
                      caretOf={loginPasswordRef}
                      revealed={loginShown}
                      expression={loginShown ? sleepy : submitting ? thinking : undefined}
                      title={submitting ? 'Loggar in…' : loginShown ? 'Tittar bort — lösenordet syns i klartext' : 'Din Rögleblobb'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">E-postadress</label>
                    <input id="email" className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Lösenord</label>
                    <div className="blobatar-password-field-input-wrap">
                      <input
                        ref={loginPasswordRef} id="password" className="form-input"
                        type={loginShown ? 'text' : 'password'} autoComplete="current-password"
                        value={password} onChange={e => setPassword(e.target.value)} required
                      />
                      <button
                        type="button" tabIndex={-1}
                        aria-pressed={loginShown} aria-label={loginShown ? 'Dölj lösenord' : 'Visa lösenord'}
                        title={loginShown ? 'Dölj lösenord' : 'Visa lösenord'}
                        onClick={() => { setLoginShown(s => !s); loginPasswordRef.current?.focus() }}
                        className="blobatar-password-field-toggle"
                      >
                        {loginShown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                    {submitting ? 'Loggar in…' : 'Logga in'}
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    style={{ display: 'block', margin: 'var(--space-3) auto 0', textAlign: 'center' }}
                    onClick={() => { setForgotSent(false); setMode('forgot') }}
                  >
                    Glömt lösenordet?
                  </button>
                </form>
              ) : mode === 'forgot' ? (
                forgotSent ? (
                  <div style={{ textAlign: 'center' }}>
                    <div className="admin-login-check" aria-hidden="true">✓</div>
                    <p className="admin-login-subtitle">
                      Om {email} har ett konto skickades en återställningslänk dit. Länken gäller i 30 minuter.
                    </p>
                    <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMode('login')}>
                      Till inloggningen
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot}>
                    <p className="admin-login-hint" style={{ marginTop: 0 }}>
                      Ange kontots e-postadress så mejlar vi en länk för att sätta ett nytt lösenord.
                    </p>
                    <div className="form-group">
                      <label className="form-label" htmlFor="email">E-postadress</label>
                      <input id="email" className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                      {submitting ? 'Skickar…' : 'Skicka återställningslänk'}
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      style={{ display: 'block', margin: 'var(--space-3) auto 0', textAlign: 'center' }}
                      onClick={() => setMode('login')}
                    >
                      Tillbaka till inloggningen
                    </button>
                  </form>
                )
              ) : (
                <form onSubmit={handleSignup}>
                  <div className="admin-login-avatar-preview">
                    <UserAvatar seed={`${email}|${intro}`} size={88} gaze title="Din Rögleblobb — ändras när du skriver" />
                    <p className="admin-login-hint" style={{ margin: 0 }}>
                      Din Rögleblobb här ändras medan du skriver e-post och presentation.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="displayName">Ditt namn</label>
                    <input id="displayName" className="form-input" type="text" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">E-postadress</label>
                    <input id="email" className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Lösenord (minst 8 tecken)</label>
                    <div className="blobatar-password-field-input-wrap">
                      <input
                        id="password" className="form-input"
                        type={signupShown ? 'text' : 'password'} autoComplete="new-password" minLength={8}
                        value={password} onChange={e => setPassword(e.target.value)} required
                      />
                      <button
                        type="button" tabIndex={-1}
                        aria-pressed={signupShown} aria-label={signupShown ? 'Dölj lösenord' : 'Visa lösenord'}
                        title={signupShown ? 'Dölj lösenord' : 'Visa lösenord'}
                        onClick={() => setSignupShown(s => !s)}
                        className="blobatar-password-field-toggle"
                      >
                        {signupShown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="intro">Presentera dig</label>
                    <textarea
                      id="intro"
                      className="form-textarea"
                      rows={4}
                      minLength={INTRO_MIN}
                      maxLength={INTRO_MAX}
                      placeholder="Vem är du, hur hänger du ihop med initiativet och vad vill du hjälpa till med?"
                      value={intro}
                      onChange={e => setIntro(e.target.value)}
                      required
                    />
                    <p className="admin-login-hint" style={{ textAlign: 'left', marginTop: 'var(--space-2)' }}>
                      Den som godkänner ditt konto läser det här. {intro.trim().length}/{INTRO_MIN} tecken.
                    </p>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                    {submitting ? 'Skapar konto…' : 'Skapa konto'}
                  </button>
                  <p className="admin-login-hint">Konton aktiveras av en superadministratör.</p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
