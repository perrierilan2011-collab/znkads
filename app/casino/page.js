import { redirect } from 'next/navigation'
import CasinoClient from '@/components/casino/CasinoClient'
import { getCurrentUser } from '@/lib/auth'
import { getCasinoConfig, getCasinoState } from '@/lib/casino'

export const metadata = {
  title: 'Casino'
}

export default async function CasinoPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const config = getCasinoConfig()

  if (!config.enabled) {
    return (
      <div className="page container">
        <div className="alert error">Le casino est momentanément désactivé.</div>
      </div>
    )
  }

  let state
  try {
    state = await getCasinoState(user.id)
  } catch (error) {
    console.error('[casino] chargement impossible', {
      code: error?.code,
      message: error?.message
    })

    return (
      <div className="page container">
        <div className="alert error">
          Impossible de charger le casino. Vérifiez que supabase/schema.sql
          (section CASINO) a bien été exécuté.
        </div>
      </div>
    )
  }

  return (
    <div className="page container">
      <CasinoClient
        username={user.discord_username}
        initialBalanceCents={user.balance_cents}
        initialStats={state.stats}
        initialFeed={state.feed}
        initialActive={state.active}
        config={config}
      />
    </div>
  )
}
