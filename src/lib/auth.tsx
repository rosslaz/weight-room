import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AUTH_STORAGE_KEY, supabase } from './supabase'
import { readJSON, writeJSON } from './offline'
import type { Profile } from './data'

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string; profile: Profile | null }

type AuthContextValue = {
  state: AuthState
  refreshProfile: () => Promise<void>
  setProfile: (p: Profile) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const profileKey = (uid: string) => `wr:${uid}:profile`

/** The session saved on this phone, read directly so an offline launch still knows who you are. */
function storedUser(): { id: string; email: string } | null {
  const raw = readJSON<{ user?: { id?: string; email?: string } } | null>(AUTH_STORAGE_KEY, null)
  const u = raw?.user
  return u?.id ? { id: u.id, email: u.email ?? '' } : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const loadProfile = useCallback(async (uid: string, email: string) => {
    const cached = readJSON<Profile | null>(profileKey(uid), null)
    setState({ status: 'signedIn', userId: uid, email, profile: cached })
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (!error && data) {
      writeJSON(profileKey(uid), data)
      setState({ status: 'signedIn', userId: uid, email, profile: data })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return
      const s = data.session
      if (s?.user) void loadProfile(s.user.id, s.user.email ?? '')
      else {
        // No signal and an expired token (it refreshes once back online): keep the user in,
        // using what's saved on the phone. Weak gym signal often reports "online", so check the error too.
        const networkProblem = !navigator.onLine || error?.name === 'AuthRetryableFetchError'
        const u = networkProblem ? storedUser() : null
        if (u) void loadProfile(u.id, u.email)
        else setState({ status: 'signedOut' })
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setState((prev) =>
          prev.status === 'signedIn' && prev.userId === session.user.id
            ? prev
            : { status: 'signedIn', userId: session.user.id, email: session.user.email ?? '', profile: null },
        )
        void loadProfile(session.user.id, session.user.email ?? '')
      } else if (event === 'SIGNED_OUT') {
        setState({ status: 'signedOut' })
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (state.status !== 'signedIn') return
    await loadProfile(state.userId, state.email)
  }, [state, loadProfile])

  const setProfile = useCallback((p: Profile) => {
    writeJSON(profileKey(p.id), p)
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, profile: p } : prev))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
    setState({ status: 'signedOut' })
  }, [])

  return (
    <AuthContext.Provider value={{ state, refreshProfile, setProfile, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** For screens that only render when signed in. */
export function useUser() {
  const { state, ...rest } = useAuth()
  if (state.status !== 'signedIn') throw new Error('useUser requires a signed-in user')
  return { ...state, ...rest }
}
