"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import DemoBanner from "@/components/DemoBanner";
import { apiFetch } from "@/lib/client";
import { formatEUR } from "@/lib/money";
import { useSession } from "@/components/SessionProvider";

const RING_R = 36;
const RING_C = 2 * Math.PI * RING_R;

export default function AdsPage() {
  const { demo } = useSession();
  const [offers, setOffers] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | watching | awaiting | validated | failed
  const [session, setSession] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const finishingRef = useRef(false);

  const loadOffers = useCallback(() => {
    apiFetch("/api/ads/offers")
      .then((d) => setOffers(d.offers || []))
      .catch(() => setOffers([]));
    apiFetch("/api/dashboard")
      .then((d) => setBalance(d.wallet.balance_cents))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  /* --- compte à rebours du visionnage --- */
  useEffect(() => {
    if (phase !== "watching") return;
    if (remaining <= 0) {
      finishView();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining]);

  /* --- attente de la confirmation de la régie (polling) --- */
  useEffect(() => {
    if (phase !== "awaiting" || !session?.token) return;
    let alive = true;

    async function check() {
      try {
        const s = await apiFetch(
          `/api/ads/status?token=${encodeURIComponent(session.token)}`
        );
        if (!alive) return;
        setStatus(s.status);
        setBalance(s.balance_cents);
        if (s.status === "validated") setPhase("validated");
        else if (["expired", "rejected"].includes(s.status)) {
          setPhase("failed");
          setMessage({
            type: "error",
            text: "La régie publicitaire n'a pas validé cette vue.",
          });
        }
      } catch {
        /* on réessaiera au prochain tick */
      }
    }

    check();
    const id = setInterval(check, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [phase, session]);

  /* --- décompte du délai entre deux publicités --- */
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function start() {
    setBusy(true);
    setMessage(null);
    finishingRef.current = false;
    try {
      const res = await apiFetch("/api/ads/start", { method: "POST" });
      setSession({ token: res.token, offer: res.offer });
      setRemaining(res.offer.duration_seconds);
      setStatus("pending");
      setPhase("watching");
    } catch (err) {
      if (err.code === "ad_in_progress" && err.data?.token) {
        setSession({ token: err.data.token, offer: null });
        setStatus("awaiting_confirmation");
        setPhase("awaiting");
      } else if (err.code === "cooldown") {
        setCooldown(err.data?.retryAfter || 20);
        setMessage({ type: "warning", text: err.message });
      } else {
        setMessage({ type: "error", text: err.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function finishView() {
    if (finishingRef.current || !session?.token) return;
    finishingRef.current = true;
    try {
      await apiFetch("/api/ads/finish", {
        method: "POST",
        body: { token: session.token },
      });
    } catch {
      /* même en cas d'erreur, on passe en attente de confirmation */
    }
    setStatus("awaiting_confirmation");
    setPhase("awaiting");
  }

  async function demoConfirm() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/ads/demo-confirm", {
        method: "POST",
        body: { token: session.token },
      });
      setStatus(res.status);
      setBalance(res.balance_cents);
      if (res.status === "validated") setPhase("validated");
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("idle");
    setSession(null);
    setStatus(null);
    setMessage(null);
    setRemaining(0);
    finishingRef.current = false;
    loadOffers();
  }

  const duration = session?.offer?.duration_seconds || 0;
  const progress =
    phase === "watching" && duration > 0
      ? Math.min(Math.max(1 - remaining / duration, 0), 1)
      : 0;

  return (
    <>
      <DemoBanner />
      <Nav variant="app" />

      <main className="container page">
        <div className="row-between section">
          <div>
            <h1 style={{ fontSize: "1.7rem", marginBottom: 4 }}>Publicités</h1>
            <p className="muted small" style={{ margin: 0 }}>
              Les vues sont confirmées par la régie publicitaire — jamais par le
              navigateur.
            </p>
          </div>
          {balance !== null && (
            <div className="user-chip">
              <span className="tiny dim">Solde</span>
              <span className="strong">{formatEUR(balance)}</span>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`alert alert-${message.type} section`}
            role="status"
          >
            <span>{message.text}</span>
          </div>
        )}

        {phase === "idle" && (
          <>
            <div className="card section">
              <h2 style={{ fontSize: "1.15rem" }}>Comment se déroule une vue ?</h2>
              <ol className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Tu lances une publicité : une vue « en attente » est créée côté serveur.</li>
                <li>Tu la regardes pendant le compte à rebours.</li>
                <li>La régie publicitaire confirme la vue via un signal serveur signé.</li>
                <li>Le montant est alors crédité sur ton solde.</li>
              </ol>
            </div>

            <div className="section">
              <h2 style={{ fontSize: "1.15rem" }}>Campagnes disponibles</h2>
              {offers.length === 0 ? (
                <div className="card">
                  <div className="empty">
                    Aucune campagne active pour le moment. Reviens plus tard.
                  </div>
                </div>
              ) : (
                <div className="grid grid-2">
                  {offers.map((o) => (
                    <div className="card" key={o.id}>
                      <div className="row-between" style={{ marginBottom: 8 }}>
                        <span className="badge badge-neutral">{o.category}</span>
                        <span className="strong text-primary">
                          +{formatEUR(o.reward_cents)}
                        </span>
                      </div>
                      <div className="strong">{o.title}</div>
                      <div className="tiny dim" style={{ marginTop: 4 }}>
                        {o.advertiser} • {o.duration_seconds}s
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={start}
              disabled={busy || cooldown > 0 || offers.length === 0}
            >
              {cooldown > 0
                ? `Disponible dans ${cooldown} s`
                : busy
                ? "Préparation…"
                : "Regarder une publicité"}
            </button>
          </>
        )}

        {phase === "watching" && (
          <div className="ad-frame">
            <span className="badge badge-info">
              <span className="dot" /> Vue en cours — non créditée
            </span>

            <div className="ad-slot">
              <span className="strong" style={{ color: "var(--text-muted)" }}>
                {session?.offer?.title}
              </span>
              <span className="tiny">
                Emplacement publicitaire fourni par la régie
              </span>
              <span className="tiny dim">
                {session?.offer?.advertiser} • {session?.offer?.network}
              </span>
            </div>

            {duration > 0 ? (
              <div className="countdown-ring">
                <svg width="84" height="84" aria-hidden="true">
                  <circle
                    cx="42"
                    cy="42"
                    r={RING_R}
                    stroke="var(--border)"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="42"
                    cy="42"
                    r={RING_R}
                    stroke="var(--primary)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - progress)}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div className="cd-value">{remaining}</div>
              </div>
            ) : (
              <div className="spinner" />
            )}

            <p className="muted small" style={{ margin: 0 }}>
              Garde cet onglet ouvert jusqu'à la fin du compte à rebours.
            </p>
          </div>
        )}

        {phase === "awaiting" && (
          <div className="ad-frame">
            <div className="spinner" />
            <h2 style={{ fontSize: "1.15rem", margin: "6px 0 0" }}>
              En attente de la confirmation de la régie
            </h2>
            <p className="muted small" style={{ maxWidth: 460, margin: 0 }}>
              Ta vue a bien été enregistrée. Le montant sera crédité
              automatiquement dès que la régie publicitaire confirmera le
              visionnage. Cette page se met à jour toute seule.
            </p>

            {demo && (
              <button
                className="btn btn-outline"
                onClick={demoConfirm}
                disabled={busy}
              >
                {busy ? "…" : "Simuler la confirmation de la régie (démo)"}
              </button>
            )}

            <button className="btn btn-ghost btn-sm" onClick={reset}>
              Retour
            </button>
          </div>
        )}

        {phase === "validated" && (
          <div className="ad-frame">
            <div
              className="logo-mark"
              style={{ width: 52, height: 52, fontSize: 22, borderRadius: 16 }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: "1.3rem", margin: 0 }}>Vue validée !</h2>
            <p className="muted" style={{ margin: 0 }}>
              La régie publicitaire a confirmé le visionnage.
            </p>
            {balance !== null && (
              <div className="stat" style={{ minWidth: 220 }}>
                <div className="stat-label">Nouveau solde</div>
                <div className="stat-value text-primary">
                  {formatEUR(balance)}
                </div>
              </div>
            )}
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-primary" onClick={reset}>
                Regarder une autre publicité
              </button>
              <Link href="/dashboard" className="btn btn-outline">
                Mon dashboard
              </Link>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="ad-frame">
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Vue non validée</h2>
            <p className="muted small" style={{ maxWidth: 460, margin: 0 }}>
              La régie publicitaire n'a pas confirmé ce visionnage. Aucun
              montant n'a été crédité, conformément à notre règle de
              transparence.
            </p>
            <button className="btn btn-outline" onClick={reset}>
              Réessayer
            </button>
          </div>
        )}
      </main>
    </>
  );
}
