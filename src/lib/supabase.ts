// PHP-API-baserat kompatibilitetslager.
// Exponerar samma yta som appen tidigare använde från `@supabase/supabase-js`
// och senare Appwrite (`supabase.from(...).select()/.eq()/.order()/.insert()/...`
// och `supabase.auth.*`) så att komponenterna kopierade oförändrade från
// NCC-Draft-RS inte behövde skrivas om — bara det här lagret bytte
// implementation, från Appwrites SDK till fetch-anrop mot server/api/*.php.
//
// Alla tabeller går mot den generiska /api/data/{table}-endpointen (se
// server/api/data.php: JsonCollection för redaktionellt innehåll inkl. karta,
// SqliteCollection för meddelanden/vittnesmål, UserCollections för
// user_roles/intranet_members/profiles).
import { apiFetch, ApiError, setCsrfToken } from '../api/client'

type Row = Record<string, any>

interface Result<T = any> { data: T; error: { message: string; code?: string } | null }

function errOf(e: unknown): { message: string; code?: string } {
  if (e instanceof ApiError) return { message: e.message, code: e.code }
  return { message: e instanceof Error ? e.message : String(e) }
}

// profiles: bara det EGNA kontots rad får skapas utan session (precis efter
// självregistrering, se AdminLogin.tsx) — den vägen går via en egen publik
// endpoint i stället för den generiska (som kräver adminsession för profiles).
async function insertPendingProfile(data: Row): Promise<Row> {
  return apiFetch<Row>('/auth/profile', {
    method: 'POST',
    body: { id: data.id, display_name: data.display_name, intro: data.intro },
  })
}

class QueryBuilder implements PromiseLike<Result> {
  private table: string
  private eqs: [string, any][] = []
  private orders: [string, 'asc' | 'desc'][] = []
  private ilikes: [string, string][] = []
  private gtes: [string, any][] = []
  private ltes: [string, any][] = []
  private _limit?: number
  private _single = false
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: any

  constructor(table: string) { this.table = table }

  select(_cols?: string) { return this }
  eq(c: string, v: any) { this.eqs.push([c, v]); return this }
  order(c: string, opts?: { ascending?: boolean }) {
    this.orders.push([c, opts?.ascending === false ? 'desc' : 'asc']); return this
  }
  limit(n: number) { this._limit = n; return this }
  maybeSingle() { this._single = true; return this }
  single() { this._single = true; return this }
  ilike(c: string, pattern: string) { this.ilikes.push([c, pattern.replace(/%/g, '')]); return this }
  gte(c: string, v: any) { this.gtes.push([c, v]); return this }
  lte(c: string, v: any) { this.ltes.push([c, v]); return this }

  insert(data: any) { this.op = 'insert'; this.payload = data; return this }
  update(data: any) { this.op = 'update'; this.payload = data; return this }
  upsert(data: any) { this.op = 'upsert'; this.payload = data; return this }
  delete() { this.op = 'delete'; return this }

  private endpoint(): string {
    return `/data/${this.table}`
  }

  private query(): string {
    const p = new URLSearchParams()
    for (const [c, v] of this.eqs) p.append(`eq[${c}]`, String(v))
    for (const [c, v] of this.ilikes) p.append(`ilike[${c}]`, v)
    for (const [c, v] of this.gtes) p.append(`gte[${c}]`, String(v))
    for (const [c, v] of this.ltes) p.append(`lte[${c}]`, String(v))
    if (this.orders.length) { const [c, dir] = this.orders[0]; p.set('order', `${c}:${dir}`) }
    if (this._limit != null) p.set('limit', String(this._limit))
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  private async run(): Promise<Result> {
    try {
      const ep = this.endpoint()
      if (this.op === 'select') {
        const rows = await apiFetch<Row[]>(`${ep}${this.query()}`)
        return { data: this._single ? (rows[0] ?? null) : rows, error: null }
      }
      if (this.op === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload]
        let last: Row | null = null
        for (const it of items) {
          last = this.table === 'profiles' && it?.id
            ? await insertPendingProfile(it)
            : await apiFetch<Row>(ep, { method: 'POST', body: it })
        }
        return { data: last, error: null }
      }
      if (this.op === 'upsert') {
        const id = this.payload?.id
        if (id) await apiFetch<Row>(`${ep}/${encodeURIComponent(id)}`, { method: 'PUT', body: this.payload })
        else await apiFetch<Row>(ep, { method: 'POST', body: this.payload })
        return { data: null, error: null }
      }
      if (this.op === 'update') {
        await apiFetch<Row[]>(`${ep}${this.query()}`, { method: 'PATCH', body: this.payload })
        return { data: null, error: null }
      }
      if (this.op === 'delete') {
        await apiFetch<{ deleted: number }>(`${ep}${this.query()}`, { method: 'DELETE' })
        return { data: null, error: null }
      }
      return { data: null, error: null }
    } catch (e) {
      return { data: this._single ? null : (this.op === 'select' ? [] : null), error: errOf(e) }
    }
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }
}

// ---- auth -------------------------------------------------------------------
type Session = { user: { id: string; email: string } } | null
type AuthListener = (event: string, session: Session) => void
const listeners: AuthListener[] = []
function emit(event: string, session: Session) { for (const l of listeners) l(event, session) }

function sessionFrom(user: Row | null): Session {
  return user ? { user: { id: user.id, email: user.email } } : null
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await apiFetch<{ user: Row | null; csrfToken: string | null }>('/auth/login', {
        method: 'POST', body: { email, password },
      })
      setCsrfToken(res.csrfToken)
      const session = sessionFrom(res.user)
      emit('SIGNED_IN', session)
      return { data: { user: session?.user ?? null, session }, error: null }
    } catch (e) {
      return { data: { user: null, session: null }, error: errOf(e) }
    }
  },
  async signUp({ email, password }: { email: string; password: string }) {
    try {
      const res = await apiFetch<{ user: { id: string; email: string } }>('/auth/signup', {
        method: 'POST', body: { email, password },
      })
      return { data: { user: res.user }, error: null }
    } catch (e) {
      return { data: { user: null }, error: errOf(e) }
    }
  },
  async signOut() {
    try { await apiFetch('/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    setCsrfToken(null)
    emit('SIGNED_OUT', null)
    return { error: null }
  },
  async getSession() {
    try {
      const res = await apiFetch<{ user: Row | null; csrfToken: string | null }>('/auth/session')
      // Csrf-token lever bara i minnet och går förlorad vid en omladdning —
      // hämtas om här så att skrivande anrop fungerar direkt efter F5.
      setCsrfToken(res.csrfToken)
      return { data: { session: sessionFrom(res.user) }, error: null }
    } catch {
      return { data: { session: null }, error: null }
    }
  },
  onAuthStateChange(cb: AuthListener) {
    listeners.push(cb)
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = listeners.indexOf(cb)
            if (i >= 0) listeners.splice(i, 1)
          },
        },
      },
    }
  },
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
}
