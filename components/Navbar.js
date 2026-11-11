import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default function Navbar({ user }) {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href={user ? '/dashboard' : '/'} className="brand" aria-label="ZNK ADS">
          <span className="brand-mark" aria-hidden="true">
            Z
          </span>
          <span>ZNK ADS</span>
        </Link>

        <nav className="nav-links" aria-label="Navigation principale">
          {user ? (
            <>
              <Link className="nav-link" href="/dashboard">
                Portefeuille
              </Link>
              <Link className="nav-link" href="/ads">
                Publicités
              </Link>
              <Link className="nav-link" href="/withdraw">
                Retirer
              </Link>
              <span className="nav-user">
                {user.discord_avatar ? (
                  <img
                    className="nav-avatar"
                    src={user.discord_avatar}
                    alt=""
                    width="26"
                    height="26"
                  />
                ) : null}
                <span className="nav-username">{user.discord_username}</span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <a className="nav-link" href="/#fonctionnement">
                Fonctionnement
              </a>
              <a className="btn btn-primary btn-sm" href="/api/auth/login">
                CONNECTER DISCORD
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
