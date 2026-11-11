"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import Avatar from "./Avatar";
import { useSession } from "./SessionProvider";

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ads", label: "Publicités" },
  { href: "/withdrawals", label: "Retraits" },
];

const PUBLIC_LINKS = [
  { href: "/#how", label: "Fonctionnement" },
  { href: "/#stats", label: "Statistiques" },
  { href: "/#transparence", label: "Transparence" },
];

export default function Nav({ variant = "app" }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links =
    variant === "app"
      ? [
          ...APP_LINKS,
          ...(user?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
        ]
      : PUBLIC_LINKS;

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Logo href={variant === "app" ? "/dashboard" : "/"} />

        <nav className={`nav-links${open ? " mobile-open" : ""}`}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${pathname === l.href ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {variant === "public" && (
            <Link
              href={user ? "/dashboard" : "/login"}
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              {user ? "Dashboard" : "Connexion"}
            </Link>
          )}
        </nav>

        <div className="spacer" />

        {variant === "app" && user && (
          <>
            <div className="user-chip hide-sm">
              <Avatar user={user} size={30} />
              <div style={{ lineHeight: 1.15 }}>
                <div className="small strong">
                  {user.display_name || user.username}
                </div>
                <div className="tiny dim">ID {user.discord_id}</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Déconnexion
            </button>
          </>
        )}

        {variant === "public" && (
          <Link
            href={user ? "/dashboard" : "/login"}
            className="btn btn-primary btn-sm hide-sm"
          >
            {user ? "Mon dashboard" : "Commencer"}
          </Link>
        )}

        <button
          className="btn btn-ghost btn-sm mobile-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
