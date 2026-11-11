"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import DemoBanner from "@/components/DemoBanner";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/client";

const ERRORS = {
  discord_not_configured:
    "La connexion Discord n'est pas encore configurée sur cette instance.",
  invalid_state: "Session de connexion expirée. Réessaie.",
  missing_code: "Connexion annulée.",
  oauth_failed: "La connexion Discord a échoué. Réessaie dans un instant.",
  account_banned: "Ce compte est suspendu. Contacte l'équipe ZNK.",
};

function LoginInner() {
  const { user, demo, config, refresh, loading } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const queryError = params.get("error");
  const next = params.get("next") || "/dashboard";

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [user, loading, router, next]);

  async function demoLogin(as) {
    setBusy(as);
    setError(null);
    try {
      await apiFetch("/api/auth/demo", { method: "POST", body: { as } });
      await refresh();
      router.replace(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const discordReady = config?.discordConfigured;
  const errorMessage = error || (queryError ? ERRORS[queryError] || "Connexion impossible." : null);

  return (
    <>
      <DemoBanner />
      <Nav variant="public" />

      <main className="container page">
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div className="card card-elev">
            <h1 style={{ fontSize: "1.6rem" }}>Connexion</h1>
            <p className="muted small">
              Chaque compte est unique et identifié par ton identifiant Discord.
            </p>

            {errorMessage && (
              <div className="alert alert-error" style={{ marginBottom: 18 }}>
                <span>{errorMessage}</span>
              </div>
            )}

            <a
              href={discordReady ? "/api/auth/discord" : undefined}
              className={`btn btn-primary btn-block${
                discordReady ? "" : " disabled"
              }`}
              aria-disabled={!discordReady}
              style={
                discordReady
                  ? { marginBottom: 12 }
                  : { marginBottom: 12, opacity: 0.5, pointerEvents: "none" }
              }
            >
              Se connecter avec Discord
            </a>
            {!loading && !discordReady && (
              <p className="hint" style={{ marginBottom: 12 }}>
                OAuth2 Discord non configuré (DISCORD_CLIENT_ID / SECRET).
              </p>
            )}

            {demo && (
              <>
                <hr className="divider" />
                <div className="badge badge-primary" style={{ marginBottom: 12 }}>
                  Mode démonstration
                </div>
                <p className="hint" style={{ marginBottom: 14 }}>
                  Aucune donnée réelle : ouvre une session avec un compte
                  fictif pour explorer l'interface.
                </p>
                <div className="stack" style={{ gap: 10 }}>
                  <button
                    className="btn btn-outline btn-block"
                    onClick={() => demoLogin("user")}
                    disabled={Boolean(busy)}
                  >
                    {busy === "user" ? "Connexion…" : "Entrer comme utilisateur (démo)"}
                  </button>
                  <button
                    className="btn btn-outline btn-block"
                    onClick={() => demoLogin("admin")}
                    disabled={Boolean(busy)}
                  >
                    {busy === "admin" ? "Connexion…" : "Entrer comme administrateur (démo)"}
                  </button>
                </div>
              </>
            )}

            <hr className="divider" />
            <p className="hint" style={{ margin: 0 }}>
              En continuant, tu acceptes que ton identifiant Discord soit
              utilisé pour identifier ton compte.{" "}
              <Link href="/" className="link">
                Retour à l'accueil
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="center-box">
          <div className="spinner" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
