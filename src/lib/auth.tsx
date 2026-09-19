import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type User = { id: string; email: string }
export type Session = { user: User }

import type { UserRole } from './types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: UserRole | null
  /** Visningsnamnet från registreringen (profiles.display_name), eller null om inget satt. */
  displayName: string | null
  isAdmin: boolean
  /** Har intranätsåtkomst — egen medlemsrad eller admin (admins är ett superset). */
  isMember: boolean
  /** Får skapa/ändra i intranätet. Falskt för läsbehörighet ("viewer"). */
  canWriteIntranet: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [hasMemberRow, setHasMemberRow] = useState(false)
  const [memberReadOnly, setMemberReadOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    setRole((data?.role as UserRole) ?? null)
  }

  async function fetchDisplayName(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    setDisplayName((data as { display_name?: string | null } | null)?.display_name ?? null)
  }

  // Intranätsåtkomst. Kollektionen är label-skyddad, så en användare utan
  // member-labeln får tom träff — då är de inte medlem.
  async function fetchMember(userId: string) {
    const { data } = await supabase
      .from('intranet_members')
      .select('user_id, read_only')
      .eq('user_id', userId)
      .maybeSingle()
    setHasMemberRow(!!data)
    setMemberReadOnly(!!(data as { read_only?: boolean } | null)?.read_only)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ;(async () => {
          await Promise.all([fetchRole(session.user.id), fetchMember(session.user.id), fetchDisplayName(session.user.id)])
          setLoading(false)
        })()
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // `loading` sätts om medan rollen hämtas. Utan det syns sessionen ett
        // ögonblick innan rollen gjort det, och allt som läser `isAdmin` dömer
        // på `role === null`: inloggningen skickade admins till intranätet, och
        // AdminGuard hann visa "Åtkomst nekad". Guarderna visar spinner så länge.
        setLoading(true)
        ;(async () => {
          await Promise.all([fetchRole(session.user.id), fetchMember(session.user.id), fetchDisplayName(session.user.id)])
          setLoading(false)
        })()
      } else {
        setRole(null)
        setHasMemberRow(false)
        setMemberReadOnly(false)
        setDisplayName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = role !== null
  const isMember = isAdmin || hasMemberRow
  // Admins och fulla medlemmar skriver; läsbehörighet ("viewer") gör det inte.
  const canWriteIntranet = isAdmin || (hasMemberRow && !memberReadOnly)

  return (
    <AuthContext.Provider value={{ session, user, role, displayName, isAdmin, isMember, canWriteIntranet, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
