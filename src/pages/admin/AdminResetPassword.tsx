import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch, ApiError } from '../../api/client'
import { useToast } from '../../lib/toast'
import UserAvatar from '../../components/UserAvatar'
import { thinking } from 'blobatar/expression'

// Sista steget i "glömt lösenord"-flödet — nås via länken som mejlas från
// AdminLogin.tsx (forgot-läget). Token-parametern kommer från serverns
// mejl (server/api/password_reset.php), inte från en inloggad session —
// sidan kräver medvetet ingen inloggning.
export default function AdminResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { show } = useToast()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (token === '') {
    return (
      <div className="admin-login-page">
        <div className="admin-login-split">
          <div className="admin-login-panel" style={{ margin: '0 auto' }}>
            <div className="admin-login-card" style={{ textAlign: 'center' }}>
              <h2 className="admin-login-title">Ogiltig länk</h2>
              <p className="admin-login-subtitle">
                Länken saknar en återställningskod. Begär en ny länk från inloggningssidan.
              </p>
              <Link className="btn btn-primary" style={{ width: '100%' }} to="/admin/login">
                Till inloggningen
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    if (password !== confirm) { show('Lösenorden matchar inte', 'error'); return }

    setSubmitting(true)
    try {
      await apiFetch('/auth/reset-password', { method: 'POST', body: { token, password } })
      setDone(true)
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Kunde inte återställa lösenordet.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-split">
        <div className="admin-login-panel" style={{ margin: '0 auto' }}>
          {done ? (
            <div className="admin-login-card" style={{ textAlign: 'center' }}>
              <div className="admin-login-check" aria-hidden="true">✓</div>
              <h2 className="admin-login-title">Lösenordet är återställt</h2>
              <p className="admin-login-subtitle">
                Alla tidigare sessioner för kontot har loggats ut. Logga in med det nya lösenordet.
              </p>
              <Link className="btn btn-primary" style={{ width: '100%' }} to="/admin/login">
                Till inloggningen
              </Link>
            </div>
          ) : (
            <div className="admin-login-card">
              <h2 className="admin-login-title">Sätt nytt lösenord</h2>
              <p className="admin-login-subtitle">Länken gäller i 30 minuter och kan bara användas en gång.</p>
              <form onSubmit={handleSubmit}>
                <div className="admin-login-avatar-preview">
                  <UserAvatar seed={token} size={72} expression={submitting ? thinking : undefined} title="Rögleblobb" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="password">Nytt lösenord (minst 8 tecken)</label>
                  <input
                    id="password" className="form-input" type="password" autoComplete="new-password"
                    minLength={8} value={password} onChange={e => setPassword(e.target.value)} required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm">Upprepa lösenordet</label>
                  <input
                    id="confirm" className="form-input" type="password" autoComplete="new-password"
                    minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                  {submitting ? 'Sparar…' : 'Sätt nytt lösenord'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
