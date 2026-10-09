import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// The publishable key is designed to ship in browser code; row-level security in the
// database decides what each signed-in user can read and write.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://pminqbepjktujzrahrbd.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_aji4Rz7I-QhQObTsozgwPQ_8tUFsCCc'

export const AUTH_STORAGE_KEY = 'wr-auth'

export const supabase = createClient<Database>(url, key, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Weight Room'

/** True when a Supabase/PostgREST error came from the network rather than the database. */
export function isNetworkError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = (error.message || '').toLowerCase()
  return !error.code && (msg.includes('fetch') || msg.includes('network') || msg.includes('load failed'))
}
