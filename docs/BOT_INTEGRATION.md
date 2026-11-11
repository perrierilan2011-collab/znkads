# Intégration de l'API bot Discord

ZNK ADS expose une API réservée au bot Discord. Elle permet de consulter un utilisateur et de faire évoluer le statut d'une demande de retrait, sans jamais modifier directement un solde.

Un exemple complet et fonctionnel est fourni dans [`examples/discord-bot/`](../examples/discord-bot/).

---

## 1. Principe de sécurité

- Toutes les routes `/api/bot/*` exigent un secret **distinct** : `BOT_API_SECRET`.
- Le secret est transmis dans un en-tête `Authorization: Bearer <secret>`.
- Il est comparé en temps constant côté serveur.
- Le bot ne peut **pas** créditer ni débiter un solde. Il peut seulement :
  - lire des données ;
  - changer le statut d'une demande de retrait (`pending`, `processing`, `accepted`, `rejected`, `paid`).
- Un passage à `rejected` déclenche un remboursement automatique et journalisé.
- Toute lecture est limitée à l'utilisateur demandé, et les montants sont renvoyés en **centimes entiers**.

---

## 2. Configuration

### Côté site (Vercel ou `.env`)

```env
BOT_API_SECRET=une-chaine-aleatoire-de-32-caracteres-minimum
NEXT_PUBLIC_SITE_URL=https://VOTRE-DOMAINE.com
```

### Côté bot

```env
DISCORD_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZNK_API_URL=https://VOTRE-DOMAINE.com
ZNK_BOT_API_SECRET=le-meme-secret-que-BOT_API_SECRET
DISCORD_GUILD_ID=123456789012345678   # optionnel, enregistrement immédiat des commandes
```

> `BOT_API_SECRET` et `ZNK_BOT_API_SECRET` doivent contenir exactement la même valeur.

Génération d'un secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 3. Format des réponses

Toutes les réponses sont JSON.

### Succès

```json
{ "ok": true, "...": "..." }
```

### Erreur

```json
{
  "ok": false,
  "error": "CODE_MACHINE",
  "message": "Message lisible"
}
```

Codes fréquents :

| Code | HTTP | Signification |
| --- | --- | --- |
| `BOT_UNAUTHORIZED` | 401 | Secret absent ou invalide. |
| `USER_NOT_FOUND` | 404 | Aucun compte pour cet identifiant Discord. |
| `INVALID_DISCORD_ID` | 400 | Identifiant Discord mal formé. |
| `INVALID_WITHDRAWAL_ID` | 400 | UUID de retrait invalide. |
| `INVALID_WITHDRAWAL_STATUS` | 400 | Statut inconnu. |
| `INVALID_WITHDRAWAL_TRANSITION` | 409 | Transition de statut interdite. |
| `WITHDRAWAL_NOT_FOUND` | 404 | Demande introuvable. |
| `RATE_LIMITED` | 429 | Trop de requêtes. |
| `CONFIG_ERROR` | 500 | Configuration serveur incomplète. |

---

## 4. Endpoints

### `GET /api/bot/user/:discordId`

Profil complet.

```bash
curl -H "Authorization: Bearer $BOT_API_SECRET" \
  https://VOTRE-DOMAINE.com/api/bot/user/123456789012345678
```

Réponse :

```json
{
  "ok": true,
  "profile": {
    "currency": "EUR",
    "user": {
      "id": "uuid",
      "discord_id": "123456789012345678",
      "discord_username": "Pseudo",
      "discord_avatar": "https://cdn.discordapp.com/...",
      "balance_cents": 1250,
      "total_earned_cents": 3000,
      "referral_code": "AB12CD34",
      "created_at": "2026-01-01T12:00:00.000Z"
    },
    "wallet": {
      "validated_ads": 42,
      "validated_ads_today": 3,
      "referrals_count": 5
    },
    "transactions": [
      {
        "id": "uuid",
        "type": "ad_reward",
        "amount_cents": 2,
        "description": "Publicite validee",
        "reference_id": "provider:reference",
        "created_at": "2026-01-01T12:00:00.000Z"
      }
    ],
    "referrals": [],
    "withdrawals": []
  }
}
```

### `GET /api/bot/user/:discordId/balance`

```json
{
  "ok": true,
  "discord_id": "123456789012345678",
  "discord_username": "Pseudo",
  "currency": "EUR",
  "balance_cents": 1250,
  "total_earned_cents": 3000,
  "validated_ads": 42,
  "validated_ads_today": 3,
  "referrals_count": 5
}
```

### `GET /api/bot/user/:discordId/transactions?limit=20`

`limit` est borné entre 1 et 100.

```json
{
  "ok": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "withdrawal_request",
      "amount_cents": -500,
      "description": "Demande de retrait",
      "reference_id": "withdrawal:uuid",
      "created_at": "2026-01-01T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/bot/user/:discordId/withdrawals?limit=20`

```json
{
  "ok": true,
  "withdrawals": [
    {
      "id": "uuid",
      "amount_cents": 500,
      "status": "pending",
      "discord_id": "123456789012345678",
      "created_at": "2026-01-01T12:00:00.000Z",
      "updated_at": "2026-01-01T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/bot/user/:discordId/referrals`

```json
{
  "ok": true,
  "referral_code": "AB12CD34",
  "referral_link": "https://VOTRE-DOMAINE.com/register?ref=AB12CD34",
  "referrals_count": 5,
  "referrals": [
    {
      "id": "uuid",
      "status": "signup_paid",
      "referral_code": "AB12CD34",
      "signup_reward_paid": true,
      "ad_reward_paid": false,
      "created_at": "2026-01-01T12:00:00.000Z",
      "referred": {
        "discord_username": "Filleul",
        "discord_avatar": "https://cdn.discordapp.com/..."
      }
    }
  ]
}
```

### `GET /api/bot/withdrawals?status=pending&limit=50`

Toutes les demandes, triées de la plus ancienne à la plus récente.

- `status` : optionnel, parmi `pending`, `processing`, `accepted`, `rejected`, `paid`.
- `limit` : 1 à 100.

```json
{
  "ok": true,
  "withdrawals": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "amount_cents": 500,
      "status": "pending",
      "discord_id": "123456789012345678",
      "created_at": "2026-01-01T12:00:00.000Z",
      "updated_at": "2026-01-01T12:00:00.000Z",
      "user": { "discord_username": "Pseudo" }
    }
  ]
}
```

### `PATCH /api/bot/withdrawals/:id/status`

`POST` est également accepté.

```bash
curl -X PATCH \
  -H "Authorization: Bearer $BOT_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"status":"paid"}' \
  https://VOTRE-DOMAINE.com/api/bot/withdrawals/UUID/status
```

Réponse :

```json
{
  "ok": true,
  "withdrawal": {
    "status": "paid",
    "changed": true,
    "refunded": false,
    "withdrawal_id": "uuid",
    "amount_cents": 500
  }
}
```

### Transitions autorisées

```text
pending    → processing | accepted | rejected
processing → accepted | rejected
accepted   → paid | rejected
paid       → (final)
rejected   → (final)
```

- Une transition identique (`pending → pending`) renvoie `changed: false`, sans effet.
- Un passage à `rejected` recrédite le montant et crée une transaction `withdrawal_refund` (`refunded: true`).
- Toute autre transition renvoie `INVALID_WITHDRAWAL_TRANSITION` (409).

---

## 5. Exemple minimal en Node.js

```js
const API_URL = process.env.ZNK_API_URL
const SECRET = process.env.ZNK_BOT_API_SECRET

async function znk(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || `Erreur API (${response.status})`)
  }
  return data
}

const { profile } = await znk(`/api/bot/user/${discordId}`)
const balance = profile.user.balance_cents / 100

await znk(`/api/bot/withdrawals/${withdrawalId}/status`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'paid' })
})
```

---

## 6. Exemple complet Discord.js

Le dossier [`examples/discord-bot/`](../examples/discord-bot/) contient un bot prêt à l'emploi :

- `/solde` — solde de l'auteur.
- `/profil utilisateur` — profil complet (staff : `Gérer le serveur`).
- `/transactions [limite]` — dernières transactions de l'auteur.
- `/retraits [utilisateur]` — demandes de retrait.
- `/retrait-statut id statut` — mise à jour du statut (staff uniquement).
- `/retraits-en-attente` — file d'attente des retraits (staff uniquement).

Installation :

```bash
cd examples/discord-bot
npm install
cp .env.example .env
npm start
```

---

## 7. Bonnes pratiques

1. **Ne jamais exposer** `BOT_API_SECRET` dans une commande, un embed, un log public ou le code source.
2. **Vérifier les permissions Discord** avant toute commande d'administration (l'exemple utilise `ManageGuild`).
3. **Ne pas automatiser** le passage à `paid` : il doit correspondre à un paiement réellement effectué.
4. **Gérer les erreurs** : afficher le message renvoyé par l'API, sans divulguer d'informations sensibles.
5. **Limiter les appels** : l'API applique déjà une limite par IP ; évitez les boucles de polling.
6. **Utiliser HTTPS** en production.
7. **Un seul secret par environnement** : ne pas réutiliser `SESSION_SECRET` ou `DISCORD_CLIENT_SECRET` comme `BOT_API_SECRET`.

---

## 8. Dépannage

| Symptôme | Cause | Correction |
| --- | --- | --- |
| `401 BOT_UNAUTHORIZED` | Secret absent ou différent | Vérifier `BOT_API_SECRET` côté site et `ZNK_BOT_API_SECRET` côté bot. |
| `500 CONFIG_ERROR` | `BOT_API_SECRET` < 32 caractères ou absent | Renseigner un secret valide puis redéployer. |
| `404 USER_NOT_FOUND` | L'utilisateur ne s'est jamais connecté au site | Il doit d'abord se connecter via Discord. |
| `409 INVALID_WITHDRAWAL_TRANSITION` | Statut déjà final ou saut d'étape | Respecter l'ordre `pending → processing → accepted → paid`. |
| `429 RATE_LIMITED` | Trop de requêtes | Espacer les appels. |
| `ECONNREFUSED` en local | URL API incorrecte | Vérifier `ZNK_API_URL` (`http://localhost:3000` en dev). |
