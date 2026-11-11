"use client";

import { useCallback, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import DemoBanner from "@/components/DemoBanner";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/client";
import { formatEUR, formatDate } from "@/lib/money";
import { useSession } from "@/components/SessionProvider";

export default function WithdrawalsPage() {
  const { config } = useSession();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paypal");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(() => {
    apiFetch("/api/withdrawals")
      .then((d) => {
        setData(d);
        setMethod((m) => (d.methods.some((x) => x.value === m) ? m : d.methods[0]?.value || "paypal"));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch("/api/withdrawals", {
        method: "POST",
        body: { amount, method, destination },
      });
      setSuccess({
        amount: res.withdrawal.amount_cents,
        ticketUrl: res.ticket?.url || res.withdrawal.ticket_url || null,
      });
      setAmount("");
      setDestination("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openTicket() {
    setError(null);
    if (data?.botConfigured) {
      setTicketBusy(true);
      try {
        const res = await apiFetch("/api/ticket", {
          method: "POST",
          body: { subject: "Support ZNK Ads" },
        });
        window.open(res.url, "_blank", "noopener");
      } catch (err) {
        setError(err.message);
      } finally {
        setTicketBusy(false);
      }
    } else if (config?.discordInvite) {
      window.open(config.discordInvite, "_blank", "noopener");
    }
  }

  const canOpenTicket = Boolean(data?.botConfigured || config?.discordInvite);

  if (!data) {
    return (
      <>
        <DemoBanner />
        <Nav variant="app" />
        <div className="center-box">
          <div className="spinner" />
          <span>Chargement…</span>
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
          <h1 style={{ fontSize: "1.7rem", marginBottom: 4 }}>Retraits</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Montant minimum : {formatEUR(data.minWithdrawalCents)} • traitement
            manuel par l'équipe via Discord.
          </p>
        </div>

        {error && (
          <div className="alert alert-error section">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success section">
            <span>
              Demande de {formatEUR(success.amount)} envoyée.{" "}
              {success.ticketUrl ? (
                <a
                  className="link"
                  href={success.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir le ticket Discord
                </a>
              ) : (
                "L'équipe la traitera prochainement."
              )}
            </span>
          </div>
        )}

        <div className="grid grid-3 section">
          <div className="card card-elev">
            <div className="card-title">Solde disponible</div>
            <div className="big-number text-primary">
              {formatEUR(data.balance_cents)}
            </div>
            <div className="muted small">
              Total gagné : {formatEUR(data.total_earned_cents)}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <form onSubmit={submit}>
              <div className="grid grid-2">
                <div className="field">
                  <label className="label" htmlFor="amount">
                    Montant (€)
                  </label>
                  <input
                    id="amount"
                    className="input"
                    inputMode="decimal"
                    placeholder="5,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ alignSelf: "flex-start", padding: "4px 8px" }}
                    onClick={() =>
                      setAmount((data.balance_cents / 100).toFixed(2).replace(".", ","))
                    }
                  >
                    Tout retirer
                  </button>
                </div>

                <div className="field">
                  <label className="label" htmlFor="method">
                    Méthode
                  </label>
                  <select
                    id="method"
                    className="select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {data.methods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="destination">
                  Destination
                </label>
                <input
                  id="destination"
                  className="input"
                  placeholder="Email PayPal, adresse crypto…"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
                <span className="hint">
                  Vérifie bien ces informations : un versement envoyé ne peut pas
                  être annulé.
                </span>
              </div>

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy || data.balance_cents < data.minWithdrawalCents}
                >
                  {busy ? "Envoi…" : "Demander le retrait"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={openTicket}
                  disabled={!canOpenTicket || ticketBusy}
                >
                  {ticketBusy ? "Ouverture…" : "Ouvrir un ticket Discord"}
                </button>
              </div>

              {data.balance_cents < data.minWithdrawalCents && (
                <p className="hint" style={{ marginTop: 10 }}>
                  Il te faut au moins {formatEUR(data.minWithdrawalCents)} pour
                  demander un retrait.
                </p>
              )}
              {!canOpenTicket && (
                <p className="hint" style={{ marginTop: 10 }}>
                  Aucun canal Discord configuré (bot ou lien d'invitation).
                </p>
              )}
            </form>
          </div>
        </div>

        <section className="section">
          <h2 style={{ fontSize: "1.2rem" }}>Historique des demandes</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Méthode</th>
                  <th>Statut</th>
                  <th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty">Aucune demande pour l'instant.</div>
                    </td>
                  </tr>
                )}
                {data.withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="muted nowrap">{formatDate(w.created_at)}</td>
                    <td className="strong">{formatEUR(w.amount_cents)}</td>
                    <td className="muted">{w.method}</td>
                    <td>
                      <StatusBadge status={w.status} />
                    </td>
                    <td>
                      {w.ticket_url ? (
                        <a
                          className="link small"
                          href={w.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ouvrir
                        </a>
                      ) : (
                        <span className="dim small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
