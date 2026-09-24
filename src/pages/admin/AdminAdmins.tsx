import { useEffect, useMemo, useState } from 'react'
import UserAvatar from '../../components/UserAvatar'
import PasswordField from '../../components/PasswordField'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../api/client'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort } from '../../lib/utils'
import type { UserRole } from '../../lib/types'

// En behörighetsnivå per person. De tre första är admin-roller (user_roles);
// "intranet" är intranätsåtkomst via Appwrite-labeln "member" och ger INGEN
// åtkomst till adminpanelen. Nivåerna hålls isär mekaniskt men visas som en
// gemensam lista här.
type Level = UserRole | 'intranet' | 'viewer'

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: 'superadmin', label: 'Superadmin', desc: 'Full åtkomst: allt innehåll, inställningar och användarhantering.' },
  { value: 'redaktor', label: 'Redaktör', desc: 'Allt innehåll och kommunikation. Inte inställningar eller användare.' },
  { value: 'skribent', label: 'Skribent', desc: 'Skriver nyheter, ämnen, dokument och media.' },
  { value: 'intranet', label: 'Intranät', desc: 'Det interna arbetsrummet – läser och skriver. Ingen adminpanel.' },
  { value: 'viewer', label: 'Intranät (läsa)', desc: 'Ser det interna arbetsrummet men kan inte skapa eller ändra något.' },
]
const levelLabel = (l: Level) => LEVELS.find(x => x.value === l)?.label ?? l
const isAdminLevel = (l: Level): l is UserRole => l !== 'intranet' && l !== 'viewer'
const isIntranetLevel = (l: Level) => l === 'intranet' || l === 'viewer'
// Vilken Appwrite-åtkomstlabel varje nivå motsvarar (den faktiska gränsen).
const accessLabelFor = (l: Level): 'admin' | 'member' | 'viewer' =>
  isAdminLevel(l) ? 'admin' : l === 'viewer' ? 'viewer' : 'member'

interface Person {
  user_id: string
  level: Level
  display_name: string | null
  /** Presentationen personen skrev när kontot skapades. */
  intro: string | null
  created_at: string
}
interface PendingUser { id: string; display_name: string | null; intro: string | null; created_at: string }

export default function AdminAdmins() {
  const { user: currentUser, role: currentRole } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [people, setPeople] = useState<Person[]>([])
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pwdFor, setPwdFor] = useState<string | null>(null)
  const [pwdValue, setPwdValue] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [sendingPwd, setSendingPwd] = useState<string | null>(null)
  // Presentationer fälls ut en i taget i listan över aktiva – i väntelistan
  // står de alltid framme, för där är de underlaget för beslutet.
  const [introFor, setIntroFor] = useState<string | null>(null)
  // Adresserna ligger i Appwrites konton, inte i någon kollektion, och hämtas
  // via /api/list-users. Funktionen finns bara i den publicerade versionen —
  // lokalt visas namnet utan adress i stället för ett felmeddelande.
  const [emails, setEmails] = useState<Record<string, string | null>>({})
  // Adresserna kommer via ett separat, långsammare anrop än resten av listan.
  // Utan den här flaggan hinner blobbarna visas med id som frö och sedan
  // byta figur när adressen dyker upp — kladdigt. Se renderingen nedan: en
  // tom platshållare tills adressen faktiskt finns.
  const [emailsLoaded, setEmailsLoaded] = useState(false)

  useEffect(() => { load(); loadEmails() }, [])

  useEffect(() => {
    if (!pwdFor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPwdFor(null); setPwdValue('') } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pwdFor])

  async function loadEmails() {
    try {
      const data = await apiFetch<{ emails: Record<string, string | null> }>('/users/emails')
      if (data?.emails) setEmails(data.emails)
    } catch {
      // Går inte att nå (t.ex. otillräcklig behörighet) – listan fungerar ändå.
    } finally {
      setEmailsLoaded(true)
    }
  }

  async function load() {
    setLoading(true)
    const [rolesRes, profilesRes, membersRes] = await Promise.all([
      supabase.from('user_roles').select('user_id, role, created_at').order('created_at'),
      supabase.from('profiles').select('id, display_name, intro, created_at').order('created_at'),
      supabase.from('intranet_members').select('user_id, display_name, read_only, created_at').order('created_at'),
    ])
    const roleRows = (rolesRes.data ?? []) as Array<Record<string, unknown>>
    const profileRows = (profilesRes.data ?? []) as Array<Record<string, unknown>>
    const memberRows = (membersRes.data ?? []) as Array<Record<string, unknown>>

    const nameById = new Map(profileRows.map(p => [p.id as string, (p.display_name as string | null) ?? null]))
    const introById = new Map(profileRows.map(p => [p.id as string, (p.intro as string | null) ?? null]))
    const adminIds = new Set(roleRows.map(r => r.user_id as string))

    const list: Person[] = roleRows.map(r => ({
      user_id: r.user_id as string,
      level: r.role as Level,
      display_name: nameById.get(r.user_id as string) ?? null,
      intro: introById.get(r.user_id as string) ?? null,
      created_at: r.created_at as string,
    }))
    // Medlemmar som inte också är admins (admins har redan intranätsåtkomst).
    for (const m of memberRows) {
      if (adminIds.has(m.user_id as string)) continue
      list.push({
        user_id: m.user_id as string,
        level: m.read_only ? 'viewer' : 'intranet',
        display_name: nameById.get(m.user_id as string) ?? (m.display_name as string | null) ?? null,
        intro: introById.get(m.user_id as string) ?? null,
        created_at: m.created_at as string,
      })
    }
    const accessIds = new Set(list.map(p => p.user_id))

    setPeople(list)
    setPending(profileRows.filter(p => !accessIds.has(p.id as string))
      .map(p => ({ id: p.id as string, display_name: p.display_name as string | null, intro: p.intro as string | null, created_at: p.created_at as string })))
    setLoading(false)
  }

  /**
   * Fanns tidigare för att sätta en separat Appwrite-åtkomstlabel — den
   * faktiska säkerhetsgränsen låg där, inte i user_roles/intranet_members.
   * I den här versionen ÄR rollraden/medlemsraden hela gränsen (se
   * DataController i server/api/data.php), så det finns inget kvar att sätta.
   * Kvar som no-op så att anropsplatserna nedan (som avgör ordning: åtkomst
   * ges INNAN raderna skrivs) inte behöver ändras.
   */
  async function setAccess(_userId: string, _access: 'admin' | 'member' | 'viewer' | 'none'): Promise<boolean> {
    return true
  }

  /** Ger en person utan åtkomst en startnivå. */
  async function assignLevel(u: PendingUser, level: Level) {
    setBusy(u.id)
    try {
      if (isIntranetLevel(level)) {
        if (!(await setAccess(u.id, accessLabelFor(level)))) return
        const { error } = await supabase.from('intranet_members').insert({ user_id: u.id, display_name: u.display_name, read_only: level === 'viewer', added_by: currentUser?.email ?? null })
        if (error) { show('Åtkomst gavs, men raden kunde inte sparas: ' + error.message, 'error'); return }
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: u.id, role: level })
        if (error) { show('Kunde inte tilldela: ' + error.message, 'error'); return }
        // Labeln "admin" är det som faktiskt ger skrivrätt — rollraden ensam räcker inte.
        if (!(await setAccess(u.id, 'admin'))) { show('Roll tilldelad men admin-behörighet kunde inte sättas', 'error'); return }
      }
      show(`${u.display_name || 'Användaren'}: ${levelLabel(level)}`, 'success')
      load()
    } finally { setBusy(null) }
  }

  /**
   * Byter nivå på en person med befintlig åtkomst. Den nya åtkomstlabeln sätts
   * FÖRST, så att ingen står helt utan under bytet, sedan städas rad-tillstånden
   * (user_roles för admin-nivåer, intranet_members för intranät-nivåer).
   */
  async function changeLevel(p: Person, next: Level) {
    if (next === p.level) return
    setBusy(p.user_id)
    try {
      if (!(await setAccess(p.user_id, accessLabelFor(next)))) return

      // Rollrad (user_roles) – bara admin-nivåer har en.
      if (isAdminLevel(next)) {
        if (isAdminLevel(p.level)) await supabase.from('user_roles').update({ role: next }).eq('user_id', p.user_id)
        else await supabase.from('user_roles').insert({ user_id: p.user_id, role: next })
      } else if (isAdminLevel(p.level)) {
        await supabase.from('user_roles').delete().eq('user_id', p.user_id)
      }

      // Medlemsrad (intranet_members) – intranät-nivåerna har en; read_only skiljer dem.
      if (isIntranetLevel(next)) {
        const read_only = next === 'viewer'
        if (isIntranetLevel(p.level)) await supabase.from('intranet_members').update({ read_only }).eq('user_id', p.user_id)
        else await supabase.from('intranet_members').insert({ user_id: p.user_id, display_name: p.display_name, read_only, added_by: currentUser?.email ?? null })
      } else if (isIntranetLevel(p.level)) {
        await supabase.from('intranet_members').delete().eq('user_id', p.user_id)
      }

      show(`${p.display_name || 'Användaren'}: ${levelLabel(next)}`, 'success')
      load()
    } finally { setBusy(null) }
  }

  /**
   * Raderar ett konto som ännu inte fått någon nivå — själva kontot, inte bara
   * en rad. Servern kontrollerar en gång till att kontot saknar behörighet, så
   * knappen kan inte användas för att radera en kollega.
   */
  async function deleteAccount(u: PendingUser) {
    const namn = u.display_name || emails[u.id] || 'kontot'
    if (!(await confirm({
      message: `Radera ${namn} permanent? Kontot och dess presentation tas bort helt och personen kan inte logga in igen. Det går inte att ångra.`,
      confirmText: 'Radera kontot',
      danger: true,
    }))) return
    setBusy(u.id)
    try {
      await apiFetch('/users/delete', { method: 'POST', body: { userId: u.id } })
      show(`${namn} raderat`, 'success')
      load()
    } catch (e) {
      show('Kunde inte radera: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setBusy(null) }
  }

  async function removeAccess(p: Person) {
    if (p.user_id === currentUser?.id) { show('Du kan inte ta bort dig själv', 'error'); return }
    if (!(await confirm({ message: `Ta bort all åtkomst för ${p.display_name || 'användaren'}?`, confirmText: 'Ta bort åtkomst', danger: true }))) return
    setBusy(p.user_id)
    try {
      if (!(await setAccess(p.user_id, 'none'))) return
      if (isIntranetLevel(p.level)) {
        await supabase.from('intranet_members').delete().eq('user_id', p.user_id)
      } else {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', p.user_id)
        if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
      }
      show('Åtkomst borttagen', 'success')
      load()
    } finally { setBusy(null) }
  }

  async function setUserPassword(userId: string) {
    if (pwdValue.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    setPwdBusy(true)
    try {
      await apiFetch('/users/password', { method: 'POST', body: { userId, password: pwdValue } })
      show('Lösenordet uppdaterat', 'success')
      setPwdFor(null); setPwdValue('')
    } catch (e) {
      show('Kunde inte ändra lösenord: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setPwdBusy(false) }
  }

  /** Sätter det inskrivna lösenordet och mejlar samma lösenord till personen. */
  async function emailUserPassword(userId: string) {
    if (pwdValue.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    setSendingPwd(userId)
    try {
      await apiFetch('/users/send-password', { method: 'POST', body: { userId, password: pwdValue } })
      show('Lösenordet uppdaterat och skickat via mejl', 'success')
      setPwdFor(null); setPwdValue('')
    } catch (e) {
      show('Kunde inte skicka: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setSendingPwd(null) }
  }

  const adminCount = useMemo(() => people.filter(p => isAdminLevel(p.level)).length, [people])
  const memberCount = people.length - adminCount

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Användare</h1>
      </div>

      {/* Förklaring av nivåerna */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: 'var(--space-3)' }}>Nivåer</h2>
        <ul className="admin-level-legend">
          {LEVELS.map(l => (
            <li key={l.value}>
              <span className="badge badge-muted">{l.label}</span>
              <span>{l.desc}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 'var(--space-3)', marginBottom: 0 }}>
          Admin-nivåerna har alltid intranätsåtkomst också. Nivån <strong>Intranät</strong> ger däremot
          bara det interna arbetsrummet.
        </p>
      </div>

      {/* Väntar på nivå */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', color: 'var(--warning)' }}>
            Väntar på nivå ({pending.length})
          </h2>
          <div className="admin-list">
            {pending.map(u => (
              <div key={u.id} className="admin-list-item" style={{ flexWrap: 'wrap' }}>
                {emailsLoaded
                  ? <UserAvatar seed={emails[u.id] ?? u.id} size={36} style={{ flexShrink: 0 }} />
                  : <span className="avatar-skeleton" style={{ width: 36, height: 36 }} aria-hidden="true" />}
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">{u.display_name ?? 'Namnlös användare'}</div>
                  <div className="admin-list-item-meta">
                    <span className="badge badge-warning">Ingen åtkomst</span>
                    {emails[u.id] && <span className="admin-user-email">{emails[u.id]}</span>}
                    <span>{formatDateShort(u.created_at)}</span>
                  </div>
                  {u.intro
                    ? <p className="admin-user-intro">{u.intro}</p>
                    : <p className="admin-user-intro is-missing">Ingen presentation – kontot skapades innan presentation blev obligatorisk.</p>}
                </div>
                <div className="admin-table-actions">
                  <select
                    className="form-select" style={{ width: 'auto' }} defaultValue=""
                    disabled={busy === u.id}
                    onChange={e => { if (e.target.value) assignLevel(u, e.target.value as Level) }}
                    aria-label="Tilldela nivå"
                  >
                    <option value="" disabled>Tilldela nivå…</option>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy === u.id}
                    onClick={() => deleteAccount(u)}
                  >
                    Radera konto
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>
        Aktiva behörigheter ({people.length}) <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>· {adminCount} admin, {memberCount} intranät</span>
      </h2>

      {people.length === 0 ? (
        <div className="empty-state"><p>Ingen har åtkomst ännu.</p></div>
      ) : (
        <div className="admin-list">
          {people.map(p => {
            const isSelf = p.user_id === currentUser?.id
            const lockSelf = isSelf && currentRole === 'superadmin'
            return (
              <div key={p.user_id} className="admin-list-item" style={{ flexWrap: 'wrap' }}>
                {emailsLoaded
                  ? <UserAvatar seed={emails[p.user_id] ?? p.user_id} size={36} style={{ flexShrink: 0 }} />
                  : <span className="avatar-skeleton" style={{ width: 36, height: 36 }} aria-hidden="true" />}
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">
                    {p.display_name ?? 'Okänd användare'}
                    {isSelf && <span className="badge badge-success" style={{ marginLeft: 'var(--space-2)' }}>Du</span>}
                  </div>
                  <div className="admin-list-item-meta">
                    <span className={isAdminLevel(p.level) ? 'badge badge-muted' : 'badge badge-success'}>{levelLabel(p.level)}</span>
                    {emails[p.user_id] && <span className="admin-user-email">{emails[p.user_id]}</span>}
                    <span>{formatDateShort(p.created_at)}</span>
                  </div>
                </div>
                <div className="admin-table-actions">
                  <select
                    className="form-select" style={{ width: 'auto' }}
                    value={p.level}
                    onChange={e => changeLevel(p, e.target.value as Level)}
                    disabled={lockSelf || busy === p.user_id}
                    aria-label="Ändra nivå"
                  >
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  {p.intro && (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-expanded={introFor === p.user_id}
                      onClick={() => setIntroFor(introFor === p.user_id ? null : p.user_id)}
                    >
                      {introFor === p.user_id ? 'Dölj presentation' : 'Presentation'}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPwdFor(p.user_id); setPwdValue('') }}>
                    Byt lösenord
                  </button>
                  {!isSelf && (
                    <button className="btn btn-danger btn-sm" disabled={busy === p.user_id} onClick={() => removeAccess(p)}>Ta bort</button>
                  )}
                </div>
                {introFor === p.user_id && p.intro && (
                  <p className="admin-user-intro" style={{ flexBasis: '100%' }}>{p.intro}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--space-6)', background: 'var(--bg-alt)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Ny person: den skapar ett konto via <a href="/admin/login" className="section-link">/admin/login</a>, presenterar
          sig i formuläret och dyker sedan upp under "Väntar på nivå" – med presentationen synlig – där du väljer behörighet.
          Skräp- och testkonton raderas därifrån. Ett konto som redan har en behörighet måste först fråntas den;
          då hamnar det i väntelistan och går att radera.
        </p>
      </div>

      {pwdFor && (() => {
        const p = people.find(x => x.user_id === pwdFor)
        if (!p) return null
        const isSelf = p.user_id === currentUser?.id
        const close = () => { setPwdFor(null); setPwdValue('') }
        return (
          <div className="admin-modal-backdrop" onClick={close}>
            <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Byt lösenord" onClick={e => e.stopPropagation()}>
              <div className="admin-modal-head">
                <h3>Byt lösenord — {p.display_name || emails[p.user_id] || 'användaren'}</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Stäng</button>
              </div>
              <PasswordField
                name={emails[p.user_id] ?? p.user_id}
                label="Nytt lösenord (minst 8 tecken)"
                value={pwdValue}
                onValueChange={setPwdValue}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') setUserPassword(p.user_id) }}
              />
              <div className="admin-modal-actions">
                <button className="btn btn-ghost btn-sm" onClick={close}>Avbryt</button>
                {!isSelf && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pwdBusy || sendingPwd === p.user_id || pwdValue.length < 8}
                    onClick={() => emailUserPassword(p.user_id)}
                    data-tooltip="Sätter det inskrivna lösenordet och mejlar samma lösenord till personen"
                  >
                    {sendingPwd === p.user_id ? 'Skickar…' : 'Mejla lösenordet'}
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => setUserPassword(p.user_id)} disabled={pwdBusy || sendingPwd === p.user_id}>
                  {pwdBusy ? 'Sparar…' : 'Spara lösenord'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
