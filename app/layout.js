
import './globals.css'
import Navbar from '@/components/Navbar'
import ConfigNotice from '@/components/ConfigNotice'
import { getCurrentUser } from '@/lib/auth'

export const metadata = {
  title: {
    default: 'ZNK ADS — Plateforme publicitaire',
    template: '%s — ZNK ADS'
  },
  description:
    'Connectez Discord, regardez des publicités validées par nos partenaires et retirez vos gains. Portefeuille réel, parrainage et retraits via Discord.',
  applicationName: 'ZNK ADS',
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true },
  other: {
    monetag: 'd57140f55de8235d9434fd4bb3e722f7'
  }
}


export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08080D'
}

// Toutes les pages dependent de la session et de la configuration runtime.
export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }) {
  const user = await getCurrentUser()

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="site-shell">
          <ConfigNotice />
          <Navbar user={user} />
          <main>{children}</main>
          <footer className="footer">
            <div className="container footer-inner">
              <span>ZNK ADS — Portefeuille publicitaire</span>
              <span>Retraits traités manuellement via Discord.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
