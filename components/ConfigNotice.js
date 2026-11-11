import { validateConfig } from '@/lib/config'

export default function ConfigNotice() {
  const { valid, missing, errors } = validateConfig()

  if (valid) return null

  return (
    <div className="config-banner" role="status">
      <div className="container">
        <strong>Configuration incomplète.</strong>{' '}
        {missing.length ? (
          <span>Variables à renseigner : {missing.join(', ')}. </span>
        ) : null}
        {errors.length ? <span>{errors.join(' ')}</span> : null}
        <span> Voir .env.example et Settings → Environment Variables sur Vercel.</span>
      </div>
    </div>
  )
}
