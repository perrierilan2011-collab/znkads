import { createClient } from "@supabase/supabase-js";

let cached = null;

/**
 * Client Supabase serveur utilisant la clé service_role.
 * NE JAMAIS importer ce fichier depuis un composant client.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "znk-ads-server" } },
    });
  }
  return cached;
}
