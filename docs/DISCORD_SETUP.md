# Guide de configuration Discord

Ce guide couvre :

1. La création de l'application Discord (OAuth2 `identify`).
2. La configuration de l'URL de redirection.
3. La création du bot et la récupération de son token.
4. L'invitation du bot sur votre serveur.
5. L'invitation Discord utilisée pour les retraits.
6. La génération des secrets (`SESSION_SECRET`, `BOT_API_SECRET`).

---

## 1. Créer l'application Discord

1. Ouvrir le [Discord Developer Portal](https://discord.com/developers/applications).
2. Cliquer sur **New Application**.
3. Nommer l'application `ZNK ADS` (ou le nom de votre choix), accepter les conditions, puis **Create**.
4. Dans **General Information**, noter :
   - **Application ID** → variable `DISCORD_CLIENT_ID`
   - **Public Key** (pas nécessaire pour ce projet)

> L'Application ID n'est pas un secret. Le **Client Secret** et le **Bot Token** le sont.

---

## 2. Configurer OAuth2

1. Aller dans **OAuth2 → General**.
2. Dans **Redirects**, ajouter l'URL exacte de callback :

   ```text
   https://VOTRE-DOMAINE.com/api/auth/callback
   ```

   En local :

   ```text
   http://localhost:3000/api/auth/callback
   ```

3. Cliquer sur **Add** puis **Save Changes**.
4. Copier **Client Secret** → variable `DISCORD_CLIENT_SECRET`.
5. Dans **OAuth2 URL Generator**, cocher uniquement le scope `identify`. L'URL générée n'est pas utilisée directement : le site construit lui-même l'URL avec `DISCORD_CLIENT_ID`, `DISCORD_REDIRECT_URI` et le scope `identify`.

### Règles importantes

- `DISCORD_REDIRECT_URI` doit être **identique caractère pour caractère** à une URL déclarée dans **Redirects**.
- Pas de slash final, pas de différence `http`/`https`, pas de sous-domaine différent.
- Une seule URL de redirection est utilisée par le site. Vous pouvez en déclarer plusieurs dans Discord (local + production) et choisir celle à utiliser via la variable d'environnement.

### Variables concernées

```env
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DISCORD_REDIRECT_URI=https://VOTRE-DOMAINE.com/api/auth/callback
```

---

## 3. Créer le bot et récupérer son token

Vous avez déjà un bot : vous pouvez soit réutiliser son token, soit créer un bot dédié.

1. Dans l'application, aller dans **Bot**.
2. Cliquer sur **Reset Token** (ou **Add Bot** si aucun bot n'existe).
3. Copier le token → variable `DISCORD_BOT_TOKEN`.
4. Ne jamais commiter ce token. Si vous le perdez, réinitialisez-le.

### Intent requis

Le bot d'exemple n'utilise que les **commandes slash** : aucun intent privilégié n'est nécessaire.

Si vous ajoutez des fonctionnalités basées sur les messages ou les membres, activez les intents correspondants dans **Bot → Privileged Gateway Intents**, et uniquement ceux dont vous avez besoin.

### Secret API du bot

Le site et le bot partagent un secret **distinct** de tous les autres :

```env
BOT_API_SECRET=une-chaine-aleatoire-de-32-caracteres-minimum
```

Génération :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ce secret doit être identique :

- dans les variables d'environnement Vercel du site ;
- dans l'environnement du bot (`ZNK_BOT_API_SECRET` dans l'exemple).

Il ne doit **jamais** être envoyé au navigateur.

---

## 4. Inviter le bot sur votre serveur

Construire l'URL d'invitation :

```text
https://discord.com/api/oauth2/authorize?client_id=VOTRE_CLIENT_ID&permissions=0&scope=bot%20applications.commands
```

- `permissions=0` : le bot d'exemple n'a besoin d'aucune permission spéciale pour répondre aux commandes slash.
- `scope=bot applications.commands` : nécessaire pour les commandes slash.

Ouvrir l'URL, choisir le serveur, autoriser.

### Enregistrement des commandes

L'exemple enregistre les commandes au démarrage :

- si `DISCORD_GUILD_ID` est défini → commandes disponibles immédiatement sur ce serveur ;
- sinon → commandes globales (propagation jusqu'à 1 heure).

---

## 5. Invitation Discord pour les retraits

Les retraits sont traités manuellement. Le bouton `OUVRIR LE DISCORD` de la page `/withdraw` pointe vers une invitation configurable.

1. Dans votre serveur Discord, cliquer sur le nom du serveur → **Inviter des personnes** → **Modifier le lien d'invitation**.
2. Régler une expiration (ou « Jamais ») et un nombre d'utilisations adapté.
3. Copier le lien, par exemple :

   ```text
   https://discord.gg/abcdefg
   ```

4. Renseigner la variable :

   ```env
   DISCORD_WITHDRAWAL_INVITE_URL=https://discord.gg/abcdefg
   ```

Cette valeur peut être modifiée dans Vercel → **Settings → Environment Variables**, sans toucher au code, puis redéployée.

> Si `WITHDRAWALS_ENABLED=true` et que cette variable est absente, `/api/health` signale une configuration incomplète et la page de retrait affiche `DISCORD NON CONFIGURÉ`.

---

## 6. Générer les secrets

### `SESSION_SECRET`

Clé HMAC qui signe les cookies de session. 32 caractères minimum.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `BOT_API_SECRET`

Secret partagé avec le bot. 32 caractères minimum.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `AD_PROVIDER_SECRET`

Fourni par la régie publicitaire. Il sert à vérifier les postbacks HMAC. Il reste côté serveur.

---

## 7. Récapitulatif des variables Discord

```env
# OAuth2
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://VOTRE-DOMAINE.com/api/auth/callback

# Bot
DISCORD_BOT_TOKEN=
BOT_API_SECRET=

# Retraits
DISCORD_WITHDRAWAL_INVITE_URL=https://discord.gg/abcdefg
```

---

## 8. Vérifications

Après configuration :

1. `/api/health` doit renvoyer `200` avec `"config": { "valid": true }` et `"database": "ok"`.
2. Cliquer sur `CONNECTER DISCORD` doit ouvrir la page d'autorisation Discord.
3. Après autorisation, l'utilisateur arrive sur `/dashboard` avec une session active.
4. La table `users` dans Supabase contient une ligne avec son `discord_id`.
5. Le bouton `OUVRIR LE DISCORD` ouvre bien votre invitation.

---

## 9. Erreurs fréquentes

| Symptôme | Cause probable | Correction |
| --- | --- | --- |
| `Invalid OAuth2 redirect_uri` | URL absente ou différente dans **Redirects** | Ajouter l'URL exacte, sans slash final. |
| `state_mismatch` | Cookie d'état expiré, navigation trop lente, cookies bloqués | Réessayer ; vérifier que les cookies ne sont pas bloqués. |
| `access_denied` | L'utilisateur a refusé l'autorisation | Relancer la connexion. |
| `config` sur `/login` | Variables OAuth2 manquantes | Remplir `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`. |
| `database` sur `/login` | Schéma non exécuté | Exécuter `supabase/schema.sql`. |
| Le bot répond `401 BOT_UNAUTHORIZED` | `BOT_API_SECRET` différent entre site et bot | Aligner les deux valeurs puis redéployer/redémarrer. |
| Les commandes slash n'apparaissent pas | Commandes globales en cours de propagation | Définir `DISCORD_GUILD_ID` pour un enregistrement immédiat. |
