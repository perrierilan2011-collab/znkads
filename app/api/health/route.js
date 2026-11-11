import { NextResponse } from 'next/server'
import { getConfig, validateConfig } from '@/lib/config'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const validation = validateConfig()
  const config = getConfig()

  let database = 'not_configured'
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = getSupabaseAdmin()
      // Requete GET volontaire : un HEAD sur une table absente est rapporte
      // comme un succes (204) par supabase-js, ce qui masquerait un schema manquant.
      const { error } = await supabase.from('users').select('id').limit(1)
      database = error ? 'error' : 'ok'
    } catch {
      database = 'error'
    }
  }

  const ok = validation.valid && database === 'ok'

  return NextResponse.json(
    {
      ok,
      service: 'znk-ads',
      timestamp: new Date().toISOString(),
      config: {
        valid: validation.valid,
        missing: validation.missing,
        errors: validation.errors
      },
      database
    },
    { status: ok ? 200 : 503 }
  )
}
