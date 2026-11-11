# ZNK ADS

Plateforme publicitaire noir et violet avec connexion Discord OAuth2, portefeuille réel stocké dans Supabase, système de parrainage et retraits traités via Discord.

Ce projet n'est pas une maquette : les soldes, transactions, parrainages et demandes de retrait sont persistés dans Supabase et modifiés uniquement par des fonctions PostgreSQL atomiques côté serveur.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données Supabase](#base-de-données-supabase)
- [Fonctionnement du portefeuille](#fonctionnement-du-portefeuille)
- [Publicités partenaires](#publicités-partenaires)
- [Parrainage](#parrainage)
- [Retraits](#retraits)
- [API](#api)
- [Sécurité](#sécurité)
- [Structure du projet](#structure-du-projet)
- [Scripts](#scripts)
- [Documentation complémentaire](#documentation-complémentaire)
- [Limites à connaître](#limites-à-connaître)

---

## Fonctionnalités

- **Connexion Discord OAuth2** avec le scope `identify` uniquement. Aucun mot de passe, aucun token Discord exposé au navigateur.
- **Compte automatique** : à la première connexion, un compte est créé dans Supabase et lié définitivement à l'identifiant Discord.
- **Portefeuille réel** : solde disponible, total gagné, publicités validées, parrainages et historique des transactions. Les montants sont stockés en **centimes entiers** (`bigint`).
- **Publicités vérifiées** : la récompense est créditée uniquement après un postback signé (HMAC SHA-256) envoyé par la régie partenaire. Un compte à rebours côté client n'est jamais une preuve.
- **Parrainage** : code unique, lien personnel, compteur de filleuls, historique, récompense d'inscription et palier de publicités, configurables.
- **Retraits** : bouton `RETIRER`, page dédiée avec solde, minimum, instructions et bouton `OUVRIR LE DISCORD` pointant vers une invitation configurable.
- **Bot Discord** : API sécurisée par un secret distinct pour consulter un utilisateur, son solde, ses transactions, ses retraits et mettre à jour le statut d'une demande.
- **Design** : fond `#08080D`, violet `#8B5CF6`, grille de petits carrés, halos violets discrets, cartes translucides, police Inter, responsive.
- **Configuration centralisée** dans `lib/config.js`, sans montant ni URL codés en dur dans les pages.

---

## Stack technique

| Élément | Version / choix |
| --- | --- |
| Next.js | `15.5.29` (App Router) |
| React | `19.2.0` |
| Langage | JavaScript |
| Base de données | Supabase (PostgreSQL) |
| Auth | Discord OAuth2 (`identify`) |
| Bot | Discord.js (exemple fourni) |
| Styles | CSS personnalisé (`app/globals.css`) |
| Déploiement | Vercel ou Netlify |

Node.js `>= 20.9.0` requis.

---

## Démarrage rapide

```bash
npm install
cp .env.example .env      # Windows PowerShell : Copy-Item .env.example .env
npm run dev
```

Puis ouvrir <http://localhost:3000>.

Sans variables d'environnement, le site s'affiche mais montre un bandeau **Configuration incomplète** et `/api/health` renvoie `503`. C'est volontaire : aucune donnée fictive n'est utilisée.

Ordre de mise en route recommandé :

1. Créer le projet Supabase et exécuter [`supabase/schema.sql`](supabase/schema.sql).
2. Créer l'application Discord et renseigner les identifiants OAuth2 (voir [`docs/DISCORD_SETUP.md`](docs/DISCORD_SETUP.md)).
3. Remplir `.env`.
4. Générer `SESSION_SECRET` et `BOT_API_SECRET` (32 caractères minimum chacun).
5. Lancer `npm run dev`, se connecter avec Discord.
6. Vérifier `/api/health`.

---

## Variables d'environnement

Toutes les variables sont lues par `lib/config.js`. Aucune valeur métier n'est codée en dur dans les composants. Le fichier `.env` est ignoré par Git ; seul `.env.example` est versionné.

### Site

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Oui en production | URL publique complète, sans slash final. Ex. `https://znkads.com`. Sert aussi à construire les liens de parrainage et le cookie sécurisé. |
| `NODE_ENV` | Non | `production` sur Vercel (géré automatiquement). |

### Supabase

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Oui | URL du projet Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Clé `service_role`. **Strictement serveur**, jamais exposée au navigateur. |

### Discord OAuth2

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Oui | Application ID Discord. |
| `DISCORD_CLIENT_SECRET` | Oui | Client secret Discord. **Serveur uniquement.** |
| `DISCORD_REDIRECT_URI` | Oui | Doit correspondre exactement à `{NEXT_PUBLIC_SITE_URL}/api/auth/callback`. |

### Discord Bot

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | Non | Token du bot existant, utilisé par l'exemple Discord.js. |
| `BOT_API_SECRET` | Oui pour l'API bot | Secret distinct, partagé entre le site et le bot. 32 caractères minimum. |

### Retraits

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `DISCORD_WITHDRAWAL_INVITE_URL` | Oui si `WITHDRAWALS_ENABLED=true` | Invitation Discord affichée sur la page de retrait. Modifiable dans Vercel sans toucher au code. |
| `MINIMUM_WITHDRAWAL` | Oui | Montant minimum de retrait en euros. Ex. `5.00`. |
| `WITHDRAWALS_ENABLED` | Oui | `true` ou `false`. |

### Publicités

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `DAILY_AD_LIMIT` | Oui | Nombre maximum de publicités validées par utilisateur et par jour (UTC). |
| `AD_REWARD_AMOUNT` | Oui | Montant crédité par publicité validée, en euros. Ex. `0.02`. |
| `AD_REWARDS_ENABLED` | Oui | `false` par défaut. À passer à `true` uniquement si la régie autorise la rémunération. |
| `AD_PROVIDER` | Oui si publicités activées | Identifiant de la régie. Doit correspondre au champ `provider` du postback. |
| `AD_PROVIDER_SECRET` | Oui si publicités activées | Secret HMAC de vérification des postbacks. |
| `AD_PROVIDER_URL` | Oui si publicités activées | URL de la publicité. Placeholders supportés : `{reference}`, `{discord_id}`. |

### Parrainage

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `REFERRAL_SIGNUP_REWARD` | Oui | Bonus versé au parrain à la création du compte du filleul. Ex. `0.20`. |
| `REFERRAL_AD_REWARD` | Oui | Bonus supplémentaire lorsque le filleul atteint le palier. Ex. `0.80`. |
| `REFERRAL_REQUIRED_ADS` | Oui | Nombre de publicités validées nécessaire pour le palier. Ex. `10`. |

### Monnaie et sessions

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `CURRENCY` | Oui | Code ISO 4217 à 3 lettres. Ex. `EUR`. |
| `SESSION_SECRET` | Oui | Clé HMAC des cookies de session. 32 caractères minimum. |

Générer un secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Sur Vercel, toute modification de variable nécessite un **nouveau déploiement** pour être prise en compte.

---

## Base de données Supabase

1. Créer un projet sur <https://supabase.com>.
2. Ouvrir **SQL Editor → New query**.
3. Coller l'intégralité de [`supabase/schema.sql`](supabase/schema.sql) puis exécuter.
4. Récupérer `Project URL` et `service_role key` dans **Project Settings → API**.

Tables créées :

| Table | Rôle |
| --- | --- |
| `users` | Compte Discord, solde, total gagné, code de parrainage. |
| `transactions` | Journal de toutes les opérations financières (montants signés en centimes). |
| `referrals` | Relation parrain/filleul, récompenses versées, statut. |
| `ad_sessions` | Sessions publicitaires et leur validation. |
| `withdrawals` | Demandes de retrait et statuts. |

Contraintes et protections clés :

- `users.discord_id` et `users.referral_code` uniques.
- `referrals.referred_id` unique → **un seul parrain par compte**.
- Contrainte `referrer_id <> referred_id` → **auto-parrainage interdit**.
- Index unique `(provider, provider_reference)` → **double crédit publicitaire impossible**.
- Index unique `(user_id, type, reference_id)` → **récompenses non dupliquées**.
- Soldes en `bigint` avec `check (balance_cents >= 0)`.
- RLS activé sur les 5 tables, droits directs révoqués pour `anon` et `authenticated`.

Les modifications de solde passent par cinq fonctions `security definer` :

- `start_ad_session`
- `credit_ad_reward`
- `register_referral`
- `request_withdrawal`
- `update_withdrawal_status`

---

## Fonctionnement du portefeuille

- Tous les montants sont stockés en **centimes entiers** (`bigint`).
- Le navigateur ne peut jamais envoyer un montant à créditer.
- Chaque crédit passe par une fonction PostgreSQL qui verrouille la ligne utilisateur (`SELECT ... FOR UPDATE`), met à jour le solde et insère la transaction dans la même transaction SQL.
- Le solde affiché est relu depuis Supabase à chaque requête ; il n'est pas stocké dans le cookie de session.
- Une demande de retrait **réserve immédiatement** le montant (débit + transaction). Un refus déclenche un remboursement journalisé.

Types de transactions : `ad_reward`, `referral_signup`, `referral_ad`, `withdrawal_request`, `withdrawal_refund`, `adjustment`.

---

## Publicités partenaires

La fonctionnalité est **désactivée par défaut** (`AD_REWARDS_ENABLED=false`). Aucune régie n'est simulée.

### Flux

1. L'utilisateur clique sur `REGARDER UNE PUBLICITÉ`.
2. `POST /api/ads/start` crée une session côté serveur et renvoie une `reference` générée aléatoirement.
3. L'utilisateur est redirigé vers `AD_PROVIDER_URL`, avec `{reference}` et `{discord_id}` remplacés (ou ajoutés en paramètres `znk_ref` et `discord_id` si les placeholders sont absents).
4. La régie, après validation réelle, appelle le postback ZNK ADS.
5. Le serveur vérifie la signature, l'horodatage, la référence, l'utilisateur et la limite quotidienne, puis crédite **une seule fois**.

### Contrat de postback

Endpoint : `GET` ou `POST /api/ads/postback`

Paramètres : `provider`, `reference`, `discord_id`, `timestamp` (secondes Unix), `signature`.

```
message   = `${timestamp}.${provider}.${reference}.${discord_id}`
signature = HMAC_SHA256(AD_PROVIDER_SECRET, message)   // hex minuscule
```

- Fenêtre temporelle acceptée : **± 300 secondes**.
- `provider` doit être égal à `AD_PROVIDER`.
- Le montant n'est **jamais** lu depuis la requête : il vient de `AD_REWARD_AMOUNT`.
- Une référence déjà validée renvoie `already_processed` sans recréditer.
- Une limite quotidienne atteinte renvoie `daily_limit_reached` et rejette la session.

Exemple de calcul de signature :

```js
import crypto from 'node:crypto'

const timestamp = Math.floor(Date.now() / 1000)
const message = `${timestamp}.myprovider.REFERENCE.123456789012345678`
const signature = crypto
  .createHmac('sha256', process.env.AD_PROVIDER_SECRET)
  .update(message)
  .digest('hex')
```

> **Important** : si votre régie ne propose pas de postback serveur signé, laissez `AD_REWARDS_ENABLED=false`. Le site l'indiquera clairement et n'affichera aucun faux crédit.

---

## Parrainage

- Chaque compte reçoit un code unique (`A-Z`, `2-9`, 8 caractères) et un lien `/register?ref=CODE`.
- Le lien stocke le code dans un cookie `znk_ref` (30 jours), puis redirige vers `/login`.
- Le parrainage est appliqué **uniquement à la création du compte**.
- `register_referral` refuse l'auto-parrainage et les doublons (`referred_id` unique).
- Bonus d'inscription versé immédiatement au parrain.
- Bonus de palier versé une seule fois, lors du postback qui fait atteindre `REFERRAL_REQUIRED_ADS` publicités validées au filleul.
- Chaque bonus crée une transaction avec une référence unique.

---

## Retraits

- Bouton `RETIRER` sur le tableau de bord et la page `/withdraw`.
- La page affiche le solde, le minimum, les instructions, l'identifiant Discord et le bouton `OUVRIR LE DISCORD`.
- `POST /api/withdrawals` valide le montant côté serveur, vérifie le minimum et le solde, puis réserve le montant.
- Statuts : `pending`, `processing`, `accepted`, `rejected`, `paid`.
- Transitions autorisées :
  - `pending → processing | accepted | rejected`
  - `processing → accepted | rejected`
  - `accepted → paid | rejected`
  - `paid` et `rejected` sont finaux.
- Un passage à `rejected` rembourse automatiquement le montant réservé (transaction `withdrawal_refund`).
- Seul le bot (donc un administrateur) peut changer un statut via l'API sécurisée.
- Un retrait n'est jamais affiché comme payé avant le statut `paid`.

---

## API

### Authentification utilisateur

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/auth/login` | Redirige vers Discord OAuth2. |
| `GET` | `/api/auth/callback` | Échange le code, crée/actualise le compte, ouvre la session. |
| `POST` | `/api/auth/logout` | Ferme la session. Requiert `x-znk-csrf: 1`. |
| `GET` | `/api/auth/me` | Profil de l'utilisateur connecté. |

### Publicités

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/ads/start` | Crée une session publicitaire. Requiert `x-znk-csrf: 1`. |
| `GET`/`POST` | `/api/ads/postback` | Postback signé de la régie. |

### Parrainage et retraits

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/referrals` | Code, lien, compteur et historique. |
| `GET` | `/api/withdrawals` | Solde, minimum, invitation et historique. |
| `POST` | `/api/withdrawals` | Crée une demande. Requiert `x-znk-csrf: 1`. |

### API bot (secret distinct)

Toutes les routes bot exigent l'en-tête :

```
Authorization: Bearer <BOT_API_SECRET>
```

ou `x-bot-api-secret: <BOT_API_SECRET>`.

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/bot/user/:discordId` | Profil complet (solde, total, publicités, parrainages, transactions, retraits). |
| `GET` | `/api/bot/user/:discordId/balance` | Solde et compteurs. |
| `GET` | `/api/bot/user/:discordId/transactions?limit=20` | Transactions. |
| `GET` | `/api/bot/user/:discordId/withdrawals?limit=20` | Demandes de retrait de l'utilisateur. |
| `GET` | `/api/bot/user/:discordId/referrals` | Parrainage et filleuls. |
| `GET` | `/api/bot/withdrawals?status=pending&limit=50` | Toutes les demandes, filtrables. |
| `PATCH`/`POST` | `/api/bot/withdrawals/:id/status` | Change un statut. Corps : `{ "status": "paid" }`. |

Le bot **ne peut pas** modifier un solde directement : seule une transition de statut de retrait est autorisée, et un refus déclenche un remboursement contrôlé et journalisé.

### Diagnostic

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Vérifie la configuration et la connexion Supabase. `200` si tout est prêt, `503` sinon. |

### Codes d'erreur courants

`UNAUTHORIZED`, `CSRF_REJECTED`, `ORIGIN_REJECTED`, `RATE_LIMITED`, `CONFIG_ERROR`, `INSUFFICIENT_BALANCE`, `BELOW_MINIMUM_WITHDRAWAL`, `DAILY_LIMIT_REACHED`, `AD_REWARDS_DISABLED`, `WITHDRAWALS_DISABLED`, `INVALID_SIGNATURE`, `EXPIRED_POSTBACK`, `BOT_UNAUTHORIZED`, `INVALID_WITHDRAWAL_TRANSITION`.

---

## Sécurité

- **Sessions** : cookie HTTP-only `znk_session`, signé en HMAC SHA-256, `SameSite=Lax`, `Secure` en HTTPS, expiration 7 jours.
- **OAuth** : cookie `znk_oauth_state` à usage unique, comparaison en temps constant.
- **CSRF** : toutes les mutations exigent l'en-tête `x-znk-csrf: 1` et une origine autorisée.
- **Secrets serveur uniquement** : `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `BOT_API_SECRET`, `AD_PROVIDER_SECRET` ne sont jamais transmis au client.
- **Aucune confiance au client** : montants, limites et récompenses sont relus depuis la configuration serveur.
- **Atomicité** : verrous `FOR UPDATE` + transactions SQL pour chaque opération financière.
- **Idempotence** : références uniques en base pour les publicités et les récompenses de parrainage.
- **Journalisation** : chaque mouvement de solde crée une ligne dans `transactions`.
- **RLS** : aucune politique publique ; l'accès direct aux tables est révoqué pour `anon` et `authenticated`.
- **Rate limiting** : limiteur en mémoire par IP sur les routes sensibles. Sur Vercel, chaque instance serverless a sa propre mémoire ; pour une limite distribuée en production, brancher Upstash Redis ou Vercel KV dans `lib/rate-limit.js`.
- **En-têtes de sécurité** : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` configurés dans `next.config.js`.

---

## Structure du projet

```text
znkads/
├── app/
│   ├── api/
│   │   ├── ads/{start,postback}/
│   │   ├── auth/{login,callback,logout,me}/
│   │   ├── bot/
│   │   │   ├── user/[discordId]/{,balance,transactions,withdrawals,referrals}/
│   │   │   └── withdrawals/[id]/status/
│   │   ├── health/
│   │   ├── referrals/
│   │   └── withdrawals/
│   ├── ads/page.js
│   ├── dashboard/page.js
│   ├── login/page.js
│   ├── register/route.js
│   ├── withdraw/page.js
│   ├── error.js
│   ├── not-found.js
│   ├── layout.js
│   ├── page.js
│   └── globals.css
├── components/
│   ├── ConfigNotice.js
│   ├── CopyButton.js
│   ├── LogoutButton.js
│   ├── Navbar.js
│   ├── ReferralList.js
│   ├── StartAdButton.js
│   ├── TransactionList.js
│   ├── WithdrawalList.js
│   └── WithdrawForm.js
├── docs/
│   ├── BOT_INTEGRATION.md
│   ├── DISCORD_SETUP.md
│   └── VERCEL_SETUP.md
├── examples/
│   └── discord-bot/
│       ├── index.js
│       ├── package.json
│       └── README.md
├── lib/
│   ├── auth.js
│   ├── bot.js
│   ├── config.js
│   ├── discord.js
│   ├── errors.js
│   ├── http.js
│   ├── money.js
│   ├── rate-limit.js
│   ├── supabase.js
│   └── wallet.js
├── public/
│   └── favicon.svg
├── supabase/
│   └── schema.sql
├── .env.example
├── .gitignore
├── jsconfig.json
├── next.config.js
├── package.json
└── README.md
```

---

## Scripts

```bash
npm run dev     # développement (http://localhost:3000)
npm run build   # build de production
npm start       # serveur de production après build
```

---

## Documentation complémentaire

- [`docs/DISCORD_SETUP.md`](docs/DISCORD_SETUP.md) — créer l'application Discord, OAuth2, bot et secrets.
- [`docs/NETLIFY_SETUP.md`](docs/NETLIFY_SETUP.md) — déploiement Netlify (plugin Next.js, variables, 404, redéploiement).
- [`docs/VERCEL_SETUP.md`](docs/VERCEL_SETUP.md) — déploiement Vercel, variables d'environnement, domaine et dépannage.
- [`docs/BOT_INTEGRATION.md`](docs/BOT_INTEGRATION.md) — contrat de l'API bot et intégration au bot existant.
- [`examples/discord-bot/`](examples/discord-bot/) — bot Discord.js fonctionnel avec commandes slash.

---

## Limites à connaître

1. **Régie publicitaire** : ZNK ADS est agnostique. Il faut une régie capable d'envoyer un postback serveur signé. Sans cela, laissez `AD_REWARDS_ENABLED=false`.
2. **Retraits** : le paiement est manuel. Le site suit le statut mais n'envoie pas d'argent automatiquement.
3. **Rate limiting** : en mémoire par instance. Pour une garantie globale sur Vercel, utiliser un stockage distribué.
4. **OAuth Discord** : l'URL de redirection doit correspondre exactement, sinon Discord renvoie une erreur `redirect_uri`.
5. **Vercel** : les changements de variables d'environnement ne s'appliquent qu'après un nouveau déploiement.
6. **Aucune donnée de démonstration** : sans Supabase configuré, le site affiche une erreur explicite plutôt que de faux soldes.
