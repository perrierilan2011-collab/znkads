"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import DemoBanner from "@/components/DemoBanner";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/client";
import { formatEUR, timeAgo } from "@/lib/money";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    apiFetch("/api/dashboard")
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (e.status === 401) router.replace("/login?next=/dashboard");
        else if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  if (error) {
    return (
      <>
        <Nav variant="app" />
        <div className="container page">
          <div className="alert alert-error">{error}</div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <DemoBanner />
        <Nav variant="app" />
        <div className="center-box">
          <div className="spinner" />
          <span>Chargement du tableau de bord…</span>
        </div>
      </>
    );
  }

  const name = data.user.display_name || data.user.username;

  return (
    <>
      <DemoBanner />
      <Nav variant="app" />

      <main className="container page">
        <div className="row-between section">
          <div>
            <h1 style={{ fontSize: "1.7rem", marginBottom: 4 }}>
              Bonjour, {name}
            </h1>
            <p className="muted small" style={{ margin: 0 }}>
              Identifiant de compte : <span className="mono">{data.user.discord_id}</span>
            </p>
          </div>
          <Link href="/ads" className="btn btn-primary">
            Regarder une publicité
          </Link>
        </div>

        <section className="section">
          <div className="grid grid-3">
            <div className="card card-elev">
              <div className="card-title">Solde disponible</div>
              <div className="big-number text-primary">
                {formatEUR(data.wallet.balance_cents)}
              </div>
              <div className="muted small">
                Total gagné : {formatEUR(data.wallet.total_earned_cents)}
              </div>
              <Link
                href="/withdrawals"
                className="btn btn-outline btn-sm"
                style={{ marginTop: 16 }}
              >
                Demander un retrait
              </Link>
            </div>

            <div className="stat">
              <div className="stat-label">Publicités validées</div>
              <div className="stat-value">{data.counts.validated}</div>
              <div className="stat-hint">confirmées par la régie</div>
            </div>

            <div className="stat">
              <div className="stat-label">Gains du jour</div>
              <div className="stat-value text-success">
                {formatEUR(data.today.earned_cents)}
              </div>
              <div className="stat-hint">
                {data.today.count} vue{data.today.count > 1 ? "s" : ""} aujourd'hui
              </div>
            </div>
          </div>
        </section>

        {data.counts.awaiting > 0 && (
          <div className="alert alert-info section">
            <span>
              <strong>{data.counts.awaiting}</strong> vue
              {data.counts.awaiting > 1 ? "s" : ""} en attente de confirmation
              de la régie. Le solde sera mis à jour dès réception du signal.
            </span>
          </div>
        )}

        <section className="section">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Historique des activités</h2>
            <Link href="/ads" className="link small">
              Voir les publicités
            </Link>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Publicité</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.activity.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty">
                        Aucune activité pour l'instant. Regarde ta première
                        publicité !
                      </div>
                    </td>
                  </tr>
                )}
                {data.activity.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="strong">{v.ad_title}</div>
                      <div className="tiny dim">{v.advertiser || "Partenaire"}</div>
                    </td>
                    <td
                      className={
                        v.status === "validated" ? "text-success strong" : "muted"
                      }
                    >
                      {formatEUR(v.reward_cents)}
                    </td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="muted nowrap">{timeAgo(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {data.withdrawals.length > 0 && (
          <section className="section">
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Derniers retraits</h2>
              <Link href="/withdrawals" className="link small">
                Tout voir
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Montant</th>
                    <th>Méthode</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="strong">{formatEUR(w.amount_cents)}</td>
                      <td className="muted">{w.method}</td>
                      <td>
                        <StatusBadge status={w.status} />
                      </td>
                      <td className="muted nowrap">{timeAgo(w.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
