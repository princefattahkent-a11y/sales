import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const rawUrl = (
  import.meta.env.VITE_SUPABASE_URL || 'https://qlcevawnuwqfiujpfmyx.supabase.co'
)?.trim()

const rawAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cN-l7td8ElKGj8NwY34CfA_1i0CINYE'
)?.trim()

function isValidHttpUrl(urlString?: string): boolean {
  if (!urlString) return false
  try {
    const parsed = new URL(urlString)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function initSupabase() {
  if (!rawUrl || !rawAnonKey || !isValidHttpUrl(rawUrl)) {
    return null
  }
  try {
    return createClient<Database>(rawUrl, rawAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  } catch (error) {
    console.warn('[AI Studio] Supabase client initialization error:', error)
    return null
  }
}

export const supabase = initSupabase()
export const supabaseConfigured = Boolean(supabase)
