# Bot Discord ZNK ADS — exemple Discord.js

Exemple fonctionnel de bot Discord.js v14 connecté à l'API ZNK ADS.

Le bot permet de :

- consulter son solde (`/solde`) ;
- consulter un profil complet (`/profil`) ;
- consulter ses transactions (`/transactions`) ;
- consulter ses demandes de retrait (`/retraits`) ;
- traiter une demande de retrait (`/retrait-statut`, staff) ;
- lister les retraits en attente (`/retraits-en-attente`, staff).

Il ne modifie jamais un solde : seul le statut d'une demande de retrait peut être mis à jour, via une opération contrôlée et journalisée côté serveur.

---

## 1. Prérequis

- Node.js `>= 20.9.0`
- Un bot Discord créé (voir [`../../docs/DISCORD_SETUP.md`](../../docs/DISCORD_SETUP.md))
- Le site ZNK ADS déployé (ou lancé en local)
- La variable `BOT_API_SECRET` configurée côté site

---

## 2. Installation

```bash
cd examples/discord-bot
npm install
cp .env.example .env        # Windows PowerShell : Copy-Item .env.example .env
```

Remplir `.env` :

```env
DISCORD_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZNK_API_URL=https://VOTRE-DOMAINE.com
ZNK_BOT_API_SECRET=le-meme-secret-que-BOT_API_SECRET
DISCORD_GUILD_ID=123456789012345678
```

- `ZNK_API_URL` : URL publique du site, **sans slash final**. En local : `http://localhost:3000`.
- `ZNK_BOT_API_SECRET` : doit être **identique** à `BOT_API_SECRET` côté site (32 caractères minimum).
- `DISCORD_GUILD_ID` : optionnel. Recommandé pour enregistrer les commandes instantanément sur votre serveur. Sans cette variable, les commandes sont globales et peuvent mettre jusqu'à 1 heure à apparaître.

---

## 3. Inviter le bot

```text
https://discord.com/api/oauth2/authorize?client_id=VOTRE_CLIENT_ID&permissions=0&scope=bot%20applications.commands
```

Aucune permission spéciale n'est nécessaire : les commandes d'administration vérifient la permission Discord **Gérer le serveur** de l'utilisateur.

---

## 4. Lancer

```bash
npm start
```

Sortie attendue :

```text
[bot] connecté en tant que MonBot#1234
[bot] 6 commandes enregistrées sur le serveur 123456789012345678
```

---

## 5. Commandes

| Commande | Accès | Description |
| --- | --- | --- |
| `/solde` | Tous | Solde, total gagné, publicités validées, parrainages. |
| `/profil [utilisateur]` | Tous (soi-même) / Staff (autre membre) | Profil complet et 5 dernières transactions. |
| `/transactions [limite]` | Tous | Transactions récentes (1 à 25). |
| `/retraits [utilisateur]` | Tous (soi-même) / Staff (autre membre) | Demandes de retrait et statuts. |
| `/retrait-statut id statut` | Staff | Change le statut d'une demande. |
| `/retraits-en-attente` | Staff | File d'attente des retraits `pending`. |

Les réponses sont éphémères (visibles uniquement par l'auteur de la commande).

### Statuts de retrait

```text
pending → processing | accepted | rejected
processing → accepted | rejected
accepted → paid | rejected
paid, rejected → finaux
```

Un passage à `rejected` rembourse automatiquement le montant réservé.

---

## 6. Personnalisation

Le code est volontairement simple et lisible :

- `api(path, options)` : appel HTTP authentifié avec timeout.
- `handlers` : une fonction par commande.
- `commands` : définition des commandes slash.
- `formatMoney`, `discordDate` : formatage.

Pour ajouter une commande :

1. Ajouter un `SlashCommandBuilder` dans le tableau `commands`.
2. Ajouter la fonction correspondante dans `handlers`.
3. Redémarrer le bot (les commandes sont réenregistrées).

---

## 7. Dépannage

| Symptôme | Cause | Correction |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN est manquant` | `.env` absent ou vide | Copier `.env.example` et remplir. |
| `401 BOT_UNAUTHORIZED` | Secrets différents | Aligner `BOT_API_SECRET` (site) et `ZNK_BOT_API_SECRET` (bot). |
| `404 USER_NOT_FOUND` | L'utilisateur ne s'est jamais connecté au site | Il doit d'abord se connecter via Discord. |
| Commandes absentes | Commandes globales en propagation | Définir `DISCORD_GUILD_ID` et redémarrer. |
| `ECONNREFUSED` | `ZNK_API_URL` incorrect | Vérifier l'URL et que le site tourne. |
| `409 INVALID_WITHDRAWAL_TRANSITION` | Statut déjà final | Respecter l'ordre des transitions. |

---

## 8. Sécurité

- Ne jamais commiter `.env`.
- Ne jamais afficher `ZNK_BOT_API_SECRET` dans un embed ou un log.
- Ne pas automatiser le passage à `paid` : il doit correspondre à un paiement réel.
- Utiliser HTTPS en production.
- Utiliser un secret dédié, différent de `SESSION_SECRET` et `DISCORD_CLIENT_SECRET`.
