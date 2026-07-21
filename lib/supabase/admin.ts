import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  // Warn at startup rather than throwing — allows the app to boot even if
  // Supabase is not yet configured. Cache calls will fail gracefully.
  console.warn(
    '[supabase/admin] SUPABASE_URL or SUPABASE_SECRET_KEY is not set. ' +
    'Player name cache will be disabled.'
  )
}

// Singleton — Next.js module caching means this runs once per server process.
export const adminClient =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          // Service-role / secret key does not need session management.
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null
