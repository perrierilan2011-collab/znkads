/**
 * Client Supabase serveur.
 * Utilise exclusivement la service_role key : ne jamais importer ce fichier
 * depuis un composant client.
 */

import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './config'

let adminClient = null

export function getSupabaseAdmin() {
  if (adminClient) return adminClient

  const config = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

  adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: { 'X-Client-Info': 'znkads-server' }
    }
  })

  return adminClient
}
