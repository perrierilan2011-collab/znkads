"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import DemoBanner from "@/components/DemoBanner";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/client";
import { formatEUR, formatDate } from "@/lib/money";
import { useSession } from "@/components/SessionProvider";

const TABS = [
  { id: "users", label: "Utilisateurs" },
  { id: "ads", label: "Publicités validées" },
  { id: "withdrawals", label: "Retraits" },
];

export default function AdminPage() {
  const { demo } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("users");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    apiFetch("/api/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const userMap = useMemo(() => {
    const map = new Map();
    (data?.users || []).forEach((u) => map.set(u.id, u));
    return map;
  }, [data]);

  async function userAction(id, action) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch("/api/admin/users", { method: "PATCH", body: { id, action } });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function withdrawalAction(id, status) {
    let note = null;
    if (status === "rejected") {
      note = window.prompt("Motif du refus (optionnel) :") || null;
    }
    setBusyId(id);
    setError(null);
    try {
      await apiFetch("/api/admin/withdrawals", {
        method: "PATCH",
        body: { id, status, note },
      });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) {
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
          <span>Chargement de l'administration…</span>
        </div>
      </>
    );
  }

  return (
    <>
      <DemoBanner />
      <Nav variant="app" />

      <main className="container page">
        <div className="section">
          <h1 style={{ fontSize: "1.7rem", marginBottom: 4 }}>Administration</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Vue d'ensemble de la plateforme, des soldes et des demandes.
            {demo && " (Données fictives de démonstration.)"}
          </p>
        </div>

        {error && (
          <div className="alert alert-error section">
            <span>{error}</span>
          </div>
        )}

        <section className="section">
          <div className="grid grid-4">
            <div className="stat">
              <div className="stat-label">Utilisateurs</div>
              <div className="stat-value">{data.stats.users}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Vues validées</div>
              <div className="stat-value">{data.stats.validatedAds}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total gagné</div>
              <div className="stat-value">{formatEUR(data.stats.totalEarnedCents)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Retraits en attente</div>
              <div className="stat-value text-warning">
                {data.stats.pendingWithdrawals}
              </div>
            </div>
          </div>
        </section>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Identifiant</th>
                  <th>Solde</th>
                  <th>Total gagné</th>
                  <th>Rôle</th>
                  <th>État</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="strong">
                        {u.display_name || u.username}
                      </div>
                      <div className="tiny dim">@{u.username}</div>
                    </td>
                    <td className="mono dim">{u.discord_id}</td>
                    <td className="strong">{formatEUR(u.balance_cents)}</td>
                    <td className="muted">{formatEUR(u.total_earned_cents)}</td>
                    <td>
                      {u.role === "admin" ? (
                        <span className="badge badge-primary">Admin</span>
                      ) : (
                        <span className="badge badge-neutral">Membre</span>
                      )}
                    </td>
                    <td>
                      {u.is_banned ? (
                        <span className="badge badge-danger">Suspendu</span>
                      ) : (
                        <span className="badge badge-success">Actif</span>
                      )}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === u.id}
                          onClick={() =>
                            userAction(u.id, u.role === "admin" ? "demote" : "promote")
                          }
                        >
                          {u.role === "admin" ? "Retirer admin" : "Rendre admin"}
                        </button>
                        <button
                          className={`btn btn-sm ${
                            u.is_banned ? "btn-outline" : "btn-danger"
                          }`}
                          disabled={busyId === u.id}
                          onClick={() =>
                            userAction(u.id, u.is_banned ? "unban" : "ban")
                          }
                        >
                          {u.is_banned ? "Réactiver" : "Suspendre"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ads" && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Publicité</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Référence régie</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.adViews.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">Aucune vue enregistrée.</div>
                    </td>
                  </tr>
                )}
                {data.adViews.map((v) => {
                  const owner = userMap.get(v.user_id);
                  return (
                    <tr key={v.id}>
                      <td className="muted">
                        {owner ? owner.display_name || owner.username : "—"}
                      </td>
                      <td>
                        <div className="strong">{v.ad_title}</div>
                        <div className="tiny dim">{v.advertiser || "—"}</div>
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
                      <td className="mono dim">{v.network_reference || "—"}</td>
                      <td className="muted nowrap">{formatDate(v.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "withdrawals" && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Montant</th>
                  <th>Méthode / Destination</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">Aucune demande de retrait.</div>
                    </td>
                  </tr>
                )}
                {data.withdrawals.map((w) => {
                  const owner = userMap.get(w.user_id);
                  return (
                    <tr key={w.id}>
                      <td>
                        <div className="strong">
                          {owner ? owner.display_name || owner.username : "—"}
                        </div>
                        <div className="tiny dim mono">
                          {owner?.discord_id || ""}
                        </div>
                      </td>
                      <td className="strong">{formatEUR(w.amount_cents)}</td>
                      <td>
                        <div className="muted">{w.method}</div>
                        <div className="tiny dim mono">{w.destination}</div>
                      </td>
                      <td>
                        <StatusBadge status={w.status} />
                      </td>
                      <td className="muted nowrap">{formatDate(w.created_at)}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          {w.status === "pending" && (
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={busyId === w.id}
                              onClick={() => withdrawalAction(w.id, "approved")}
                            >
                              Approuver
                            </button>
                          )}
                          {w.status !== "paid" && w.status !== "rejected" && (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={busyId === w.id}
                              onClick={() => withdrawalAction(w.id, "paid")}
                            >
                              Marquer payé
                            </button>
                          )}
                          {w.status !== "rejected" && w.status !== "paid" && (
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={busyId === w.id}
                              onClick={() => withdrawalAction(w.id, "rejected")}
                            >
                              Refuser
                            </button>
                          )}
                          {w.ticket_url && (
                            <a
                              className="link small"
                              href={w.ticket_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ticket
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
