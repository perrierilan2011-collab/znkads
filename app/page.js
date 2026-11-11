"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import DemoBanner from "@/components/DemoBanner";
import { useSession } from "@/components/SessionProvider";
import { apiFetch } from "@/lib/client";
import { formatEUR } from "@/lib/money";

const STEPS = [
  {
    title: "Connexion Discord",
    text: "Un seul compte par personne, identifié par ton identifiant Discord unique.",
  },
  {
    title: "Tu regardes une publicité",
    text: "L'emplacement est fourni par nos partenaires via la régie publicitaire.",
  },
  {
    title: "La régie valide la vue",
    text: "La confirmation arrive côté serveur. Impossible à falsifier depuis le navigateur.",
  },
  {
    title: "Tu retires tes gains",
    text: "Demande de retrait + ticket Discord, traitement par l'équipe ZNK.",
  },
];

export default function HomePage() {
  const { user, demo } = useSession();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFetch("/api/stats")
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const ctaHref = user ? "/dashboard" : "/login";

  return (
    <>
      <DemoBanner />
      <Nav variant="public" />

      <main className="container">
        <section className="hero">
          <div className="pill-note">
            <span className="dot" style={{ background: "var(--success)" }} />
            Gains crédités après validation de la régie
          </div>
          <h1>
            ZNK Ads — <span className="text-primary">regarde, valide, encaisse.</span>
          </h1>
          <p className="lead">
            ZNK Ads rémunère le visionnage de publicités partenaires. Pas de
            faux compteurs, pas de gains inventés : ton solde augmente
            uniquement quand la régie publicitaire confirme la vue.
          </p>
          <div className="hero-actions">
            <Link href={ctaHref} className="btn btn-primary">
              Commencer
            </Link>
            <a href="#how" className="btn btn-outline">
              Comment ça marche
            </a>
          </div>
        </section>

        <section className="section" id="stats">
          <div className="grid grid-4">
            <div className="stat">
              <div className="stat-label">Utilisateurs</div>
              <div className="stat-value">
                {stats ? stats.users.toLocaleString("fr-FR") : "—"}
              </div>
              <div className="stat-hint">comptes enregistrés</div>
            </div>
            <div className="stat">
              <div className="stat-label">Publicités validées</div>
              <div className="stat-value">
                {stats ? stats.validatedAds.toLocaleString("fr-FR") : "—"}
              </div>
              <div className="stat-hint">vues confirmées par la régie</div>
            </div>
            <div className="stat">
              <div className="stat-label">Aujourd'hui</div>
              <div className="stat-value">
                {stats ? stats.todayValidated.toLocaleString("fr-FR") : "—"}
              </div>
              <div className="stat-hint">vues validées sur 24 h</div>
            </div>
            <div className="stat">
              <div className="stat-label">Déjà versés</div>
              <div className="stat-value">
                {stats ? formatEUR(stats.totalPaidCents) : "—"}
              </div>
              <div className="stat-hint">retraits payés</div>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <h2>Comment ça marche</h2>
          <p className="muted" style={{ maxWidth: 620 }}>
            Quatre étapes simples, et une règle claire : rien n'est crédité
            avant la confirmation de la régie publicitaire.
          </p>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="step" key={s.title}>
                <div className="step-num">{i + 1}</div>
                <h3 style={{ fontSize: "1rem" }}>{s.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="transparence">
          <div className="card card-elev">
            <h2>Transparence des gains</h2>
            <p className="muted">
              ZNK Ads n'invente aucun solde. Chaque vue publicitaire est
              enregistrée côté serveur, puis confirmée par un <strong>postback
              signé</strong> envoyé par la régie publicitaire. Tant que ce signal
              n'est pas reçu, la vue reste « en attente » et le solde ne bouge
              pas.
            </p>
            <div className="grid grid-3">
              <div className="stat">
                <div className="stat-label">Validation</div>
                <div className="stat-hint" style={{ marginTop: 0 }}>
                  côté serveur, via signature HMAC
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Anti-double crédit</div>
                <div className="stat-hint" style={{ marginTop: 0 }}>
                  une vue = un seul crédit, garanti
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Traçabilité</div>
                <div className="stat-hint" style={{ marginTop: 0 }}>
                  historique complet des vues et retraits
                </div>
              </div>
            </div>
            {demo && (
              <div className="alert alert-info" style={{ marginTop: 20 }}>
                <span>
                  <strong>Mode démonstration actif.</strong> Les chiffres
                  affichés sont fictifs et servent uniquement à présenter
                  l'interface.
                </span>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container row-between">
          <span>© {new Date().getFullYear()} ZNK Ads — Tous droits réservés.</span>
          <span className="row" style={{ gap: 18 }}>
            <Link href="/login" className="link">
              Connexion
            </Link>
            <span className="dim">Gains basés sur des validations réelles</span>
          </span>
        </div>
      </footer>
    </>
  );
}
