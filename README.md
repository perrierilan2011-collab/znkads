# ZNK Ads

Plateforme moderne de publicités rémunérées : **regarde. valide. encaisse.**

ZNK Ads crédite un solde **uniquement** quand la régie publicitaire confirme
réellement le visionnage (postback signé côté serveur). Aucun faux système de
gains, aucun compteur inventé.

---

## Aperçu

| Page | Rôle |
| --- | --- |
| `/` | Accueil : présentation, fonctionnement, statistiques, transparence |
| `/login` | Connexion Discord OAuth2 (+ entrée de démonstration) |
| `/dashboard` | Portefeuille, vues validées, gains du jour, historique |
| `/ads` | Emplacement publicitaire, compte à rebours, attente de la régie |
| `/withdrawals` | Solde, demande de retrait, ticket Discord, historique |
| `/admin` | Utilisateurs, soldes, vues validées, retraits |

## Stack technique

- **Next.js 15** (App Router) en **JavaScript**
- **Supabase** (PostgreSQL) — accès serveur uniquement via `service_role`
- **Discord OAuth2** pour la connexion
- **Bot Discord** (discord.js) pour les tickets
- **Vercel** pour l'hébergement
- Session par **JWT signé** (cookie `HttpOnly`), vérifié dans un middleware

---

## Démarrage rapide

```bash
npm install
npm run dev
```

Sans configuration, l'application démarre en **mode démonstration** : données
fictives clairement identifiées, aucun gain réel. Sur `/login`, clique sur
« Entrer comme utilisateur (démo) » ou « Entrer comme administrateur (démo) ».

```bash
npm run build && npm start   # build de production
```

---

## Configuration

Copiez `.env.example` vers `.env.local` et remplissez les valeurs.

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Exécutez `supabase/schema.sql` dans l'éditeur SQL.
3. Renseignez `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.

> Le schéma active RLS et **aucune policy publique** : toutes les données
> passent par le serveur Next.js avec la clé `service_role`.

### 2. Session

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Placez le résultat dans `SESSION_SECRET`.

### 3. Discord OAuth2

1. [Discord Developer Portal](https://discord.com/developers/applications) →
   *New Application* → onglet **OAuth2**.
2. Ajoutez l'URL de redirection :
   `https://votre-domaine/api/auth/discord/callback`
   (et `http://localhost:3000/api/auth/discord/callback` en local).
3. Renseignez `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_REDIRECT_URI`.

### 4. Bot Discord (tickets)

```bash
cd bot
npm install
cp .env.example .env      # renseignez le token et les IDs
npm start
```

Le bot enregistre `/ticket`, `/close` et `/stats`. Le site peut aussi ouvrir un
ticket automatiquement à chaque demande de retrait via l'API REST du bot
(`DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_TICKET_CATEGORY_ID`).

### 5. Régie publicitaire (validation réelle)

Définissez un secret partagé `AD_NETWORK_POSTBACK_SECRET`, puis indiquez à
votre régie l'URL de postback :

```
GET|POST https://votre-domaine/api/ads/postback
    ?token=<session_token>&ref=<reference>&revenue=<centimes>&sig=<signature>
```

`sig` = **HMAC-SHA256** de `` `${token}:${ref}:${revenue}` `` avec le secret.
Une signature invalide est rejetée (401). Le crédit est **idempotent** : une
vue ne peut être payée qu'une seule fois.

### 6. Administrateurs

- Ajoutez les IDs Discord dans `ADMIN_DISCORD_IDS` (séparés par des virgules),
  **ou** passez le `role` d'un utilisateur à `admin` en base.

---

## Le flux de validation (transparence)

```
Utilisateur                 Serveur ZNK                    Régie publicitaire
    │                           │                                │
    │  POST /api/ads/start      │                                │
    │──────────────────────────▶│  crée une vue « pending »      │
    │                           │  (aucun crédit)                │
    │  regarde la publicité     │                                │
    │  POST /api/ads/finish     │                                │
    │──────────────────────────▶│  vue « awaiting_confirmation » │
    │                           │◀───────────────────────────────│
    │                           │   postback signé (HMAC)        │
    │                           │   → crédit + « validated »     │
    │  GET /api/ads/status      │                                │
    │──────────────────────────▶│  renvoie le nouveau solde      │
```

Tant que le postback n'est pas reçu, le solde **ne bouge pas** et la vue reste
« en attente ». C'est la seule règle qui fait la différence entre un vrai
système de récompense et un faux.

### Mode démonstration

En démo, la confirmation de la régie est simulée par un bouton explicite
(« Simuler la confirmation de la régie (démo) »). Ce bouton **n'existe pas** en
production : la route `/api/ads/demo-confirm` répond 403 dès que Supabase est
configuré.

---

## Déploiement sur Vercel

1. Poussez le dépôt sur GitHub, importez-le dans Vercel.
2. Ajoutez les variables d'environnement (voir `.env.example`).
3. Déployez. Mettez à jour `DISCORD_REDIRECT_URI` avec l'URL de production.

Le bot Discord se déploie séparément (VPS, Railway, Fly.io…) :

```bash
cd bot && npm start
```

---

## API (routes serveur)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/config` | Configuration publique (démo, Discord, min. retrait) |
| GET | `/api/stats` | Statistiques agrégées publiques |
| GET | `/api/auth/discord` | Démarre l'OAuth2 Discord |
| GET | `/api/auth/discord/callback` | Retour OAuth2, crée la session |
| POST | `/api/auth/demo` | Connexion de démonstration (démo uniquement) |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Utilisateur courant |
| GET | `/api/dashboard` | Portefeuille, gains du jour, historique |
| GET | `/api/ads/offers` | Campagnes disponibles |
| POST | `/api/ads/start` | Démarre une vue (aucun crédit) |
| POST | `/api/ads/finish` | Fin du visionnage → attente régie |
| GET | `/api/ads/status` | État d'une vue |
| GET/POST | `/api/ads/postback` | **Postback signé de la régie** |
| POST | `/api/ads/demo-confirm` | Simule la régie (démo uniquement) |
| GET/POST | `/api/withdrawals` | Liste / crée une demande de retrait |
| POST | `/api/ticket` | Ouvre un ticket Discord de support |
| GET | `/api/admin/overview` | Vue d'ensemble admin |
| PATCH | `/api/admin/users` | Bannir / promouvoir un utilisateur |
| PATCH | `/api/admin/withdrawals` | Traiter une demande de retrait |

---

## Sécurité

- Session JWT signée dans un cookie `HttpOnly` / `SameSite=Lax` / `Secure`.
- Middleware de protection des pages privées ; contrôle des rôles refait dans
  chaque route API.
- Crédit de solde **atomique** et **idempotent** (fonction SQL `credit_ad_view`).
- Retrait : solde réservé atomiquement (`request_withdrawal`), recrédité en cas
  de refus (`reject_withdrawal`).
- Postback vérifié par **HMAC-SHA256** et comparaison à temps constant.
- Aucune clé sensible exposée au navigateur.

---

## Structure du projet

```
app/                 Pages + routes API (App Router)
components/          Composants d'interface
lib/                 Config, session, accès données, Discord, signatures
supabase/schema.sql  Schéma PostgreSQL + fonctions de crédit
bot/                 Bot Discord (tickets)
middleware.js        Protection des routes privées
```

---

## Licence

Projet privé — © ZNK Ads.
