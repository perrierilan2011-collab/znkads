# Guide de déploiement Vercel

Ce guide décrit le déploiement complet de ZNK ADS sur Vercel, la configuration des variables d'environnement et le dépannage des erreurs courantes.

---

## 1. Prérequis

- Un compte [Vercel](https://vercel.com).
- Un compte [GitHub](https://github.com) (ou GitLab / Bitbucket).
- Un projet Supabase configuré (schéma exécuté).
- Une application Discord configurée (voir [`DISCORD_SETUP.md`](DISCORD_SETUP.md)).

Le projet est une application **Next.js 15 App Router** standard. Aucun serveur Express, aucun dossier intermédiaire : `package.json` doit rester à la racine du dépôt.

---

## 2. Mettre le projet sur GitHub

> `git` n'est pas installé dans l'environnement de génération de ce projet. Les commandes ci-dessous sont à exécuter sur votre machine.

```bash
cd znkads
git init
git add .
git commit -m "ZNK ADS"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/znkads.git
git push -u origin main
```

Avant de pousser, vérifier :

- `.env` **n'est pas** versionné (il est dans `.gitignore`) ;
- `.env.example` est présent et ne contient aucun secret ;
- `node_modules/` et `.next/` ne sont pas versionnés.

Contrôle rapide :

```bash
git status
```

Si `.env` apparaît, ne pas pousser : vérifier `.gitignore`.

---

## 3. Importer le projet dans Vercel

1. Ouvrir <https://vercel.com/new>.
2. Cliquer sur **Import Git Repository** et sélectionner le dépôt `znkads`.
3. Vercel détecte automatiquement **Framework Preset : Next.js**.
4. Vérifier les réglages :

   | Réglage | Valeur |
   | --- | --- |
   | Framework Preset | Next.js |
   | Root Directory | `./` (racine du dépôt) |
   | Build Command | `npm run build` (par défaut) |
   | Output Directory | `.next` (par défaut) |
   | Install Command | `npm install` (par défaut) |
   | Node.js Version | `20.x` ou `22.x` (minimum 20.9) |

5. **Ne pas déployer tout de suite** : ajouter d'abord les variables d'environnement (section suivante). Sinon le premier déploiement affichera le bandeau « Configuration incomplète ».

---

## 4. Ajouter les variables d'environnement

Dans Vercel : **Project → Settings → Environment Variables**.

Pour chaque variable :

1. Cliquer sur **Add New**.
2. Saisir le **Key** (nom exact, sensible à la casse).
3. Saisir la **Value**.
4. Choisir les environnements : **Production**, **Preview**, **Development** (cocher au minimum Production).
5. Cliquer sur **Save**.

### Liste complète

```env
# SITE
NEXT_PUBLIC_SITE_URL=https://VOTRE-DOMAINE.com
NODE_ENV=production

# SUPABASE
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# DISCORD OAUTH2
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DISCORD_REDIRECT_URI=https://VOTRE-DOMAINE.com/api/auth/callback

# DISCORD BOT
DISCORD_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BOT_API_SECRET=une-chaine-aleatoire-de-32-caracteres-minimum

# RETRAITS DISCORD
DISCORD_WITHDRAWAL_INVITE_URL=https://discord.gg/abcdefg

# PUBLICITÉS
DAILY_AD_LIMIT=10
AD_REWARD_AMOUNT=0.02
AD_REWARDS_ENABLED=false
AD_PROVIDER=
AD_PROVIDER_SECRET=
AD_PROVIDER_URL=

# PARRAINAGE
REFERRAL_SIGNUP_REWARD=0.20
REFERRAL_AD_REWARD=0.80
REFERRAL_REQUIRED_ADS=10

# RETRAITS
MINIMUM_WITHDRAWAL=5.00
WITHDRAWALS_ENABLED=true

# MONNAIE
CURRENCY=EUR

# SESSIONS
SESSION_SECRET=une-chaine-aleatoire-de-32-caracteres-minimum
```

### Règles de saisie

- Pas de guillemets autour des valeurs.
- `NEXT_PUBLIC_SITE_URL` : URL complète, **sans slash final**.
- `DISCORD_REDIRECT_URI` : doit être identique à l'URL déclarée dans Discord. Elle dépend du domaine final.
- `SESSION_SECRET` et `BOT_API_SECRET` : 32 caractères minimum.
- Les secrets ne doivent être saisis que dans Vercel, jamais dans le dépôt.

### Variables optionnelles

- `DISCORD_BOT_TOKEN` : utile uniquement pour le bot, pas pour le site lui-même.
- `AD_PROVIDER`, `AD_PROVIDER_SECRET`, `AD_PROVIDER_URL` : obligatoires **seulement** si `AD_REWARDS_ENABLED=true`.
- `DISCORD_WITHDRAWAL_INVITE_URL` : obligatoire si `WITHDRAWALS_ENABLED=true`.

---

## 5. Déployer

1. Cliquer sur **Deploy**.
2. Attendre la fin du build. Il doit se terminer par `✓ Compiled successfully`.
3. Vercel fournit une URL du type `https://znkads-xxxx.vercel.app`.

### Important : ordre domaine / redirection

Si vous utilisez d'abord l'URL `*.vercel.app` puis ajoutez un domaine personnalisé :

1. Ajouter le domaine (section 6).
2. Mettre à jour `NEXT_PUBLIC_SITE_URL` et `DISCORD_REDIRECT_URI` avec le domaine final.
3. Mettre à jour l'URL de redirection dans le Discord Developer Portal.
4. **Redéployer**.

---

## 6. Ajouter un domaine personnalisé

1. **Project → Settings → Domains**.
2. Ajouter `VOTRE-DOMAINE.com` et éventuellement `www.VOTRE-DOMAINE.com`.
3. Configurer les enregistrements DNS chez votre registrar :
   - domaine racine : `A` vers l'IP fournie par Vercel, ou `ALIAS`/`ANAME` selon le registrar ;
   - sous-domaine `www` : `CNAME` vers `cname.vercel-dns.com`.
4. Attendre la validation et le certificat SSL (généralement quelques minutes).
5. Mettre à jour les variables et redéployer.

---

## 7. Redéploiement obligatoire après modification

Vercel ne réinjecte pas les nouvelles variables dans un déploiement existant.

Après **toute** modification de variable :

1. **Deployments** → sélectionner le dernier déploiement → **Redeploy**, ou
2. pousser un nouveau commit, ou
3. utiliser la CLI :

   ```bash
   npx vercel --prod
   ```

Sans redéploiement, l'ancienne configuration reste active.

---

## 8. Configuration Supabase côté production

1. Dans Supabase → **SQL Editor**, exécuter `supabase/schema.sql` sur le projet de production.
2. Vérifier que les 5 tables existent : `users`, `transactions`, `referrals`, `ad_sessions`, `withdrawals`.
3. Vérifier que RLS est activé sur chacune.
4. Récupérer l'URL et la clé `service_role` dans **Project Settings → API**.
5. Renseigner `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans Vercel.
6. Redéployer.

> La clé `service_role` contourne RLS. Elle ne doit exister que côté serveur. Ne jamais la préfixer par `NEXT_PUBLIC_`.

---

## 9. Vérifier le déploiement

### `/api/health`

```bash
curl -i https://VOTRE-DOMAINE.com/api/health
```

Réponse attendue :

```json
{
  "ok": true,
  "service": "znk-ads",
  "config": { "valid": true, "missing": [], "errors": [] },
  "database": "ok"
}
```

Si `ok` vaut `false`, la réponse indique précisément les variables manquantes ou les erreurs de format.

### Parcours utilisateur

1. `GET /` → page d'accueil.
2. `CONNECTER DISCORD` → autorisation Discord.
3. Retour sur `/dashboard` avec session active.
4. La ligne utilisateur apparaît dans Supabase.
5. `/withdraw` affiche le bouton `OUVRIR LE DISCORD`.

---

## 10. Dépannage

### Le build échoue

| Message | Cause | Correction |
| --- | --- | --- |
| `No such file or directory: app/layout.js` | Root Directory incorrect | Mettre Root Directory sur la racine du dépôt. |
| `Module not found: Can't resolve '@/lib/...'` | `jsconfig.json` absent ou Root Directory incorrect | Vérifier que `jsconfig.json` est à la racine. |
| `next: not found` | Dépendances non installées | Vérifier que `package.json` contient `next` et que l'Install Command est `npm install`. |
| Conflit de peer dependencies React | Version React incorrecte | Le projet utilise `react@19.2.0` et `react-dom@19.2.0`. Ne pas mélanger avec React 18. |
| `outputFileTracingRoot` warning | Plusieurs lockfiles sur la machine | Le projet définit déjà `outputFileTracingRoot` dans `next.config.js`. |

### Le site affiche « Configuration incomplète »

- Une ou plusieurs variables obligatoires manquent.
- Lire la liste affichée dans le bandeau ou appeler `/api/health`.
- Ajouter les variables, puis **redéployer**.

### Erreur OAuth Discord

| Message | Cause | Correction |
| --- | --- | --- |
| `Invalid OAuth2 redirect_uri` | `DISCORD_REDIRECT_URI` différente de l'URL déclarée | Aligner les deux, sans slash final. |
| `state_mismatch` | Cookie d'état perdu | Vérifier le domaine, les cookies, et réessayer. |
| `database` | Schéma non exécuté | Exécuter `supabase/schema.sql`. |
| `config` | Variables Discord manquantes | Renseigner les trois variables OAuth2. |

### Les retraits renvoient une erreur

- `WITHDRAWALS_DISABLED` : `WITHDRAWALS_ENABLED=false`.
- `CONFIG_ERROR` avec `DISCORD_WITHDRAWAL_INVITE_URL` : ajouter l'invitation.
- `BELOW_MINIMUM_WITHDRAWAL` : montant inférieur à `MINIMUM_WITHDRAWAL`.
- `INSUFFICIENT_BALANCE` : solde insuffisant.

### L'API bot renvoie `401`

- `BOT_API_SECRET` absent ou inférieur à 32 caractères côté site.
- Secret différent entre le site et le bot.
- En-tête mal formé : utiliser `Authorization: Bearer <secret>`.

### Les publicités ne se créditent pas

- `AD_REWARDS_ENABLED=false` : comportement normal.
- `AD_PROVIDER` différent du `provider` envoyé par la régie.
- Signature HMAC invalide ou horodatage hors fenêtre (± 300 s).
- Référence inconnue : elle doit provenir de `POST /api/ads/start`.
- Limite quotidienne atteinte.

---

## 11. Déploiement via la CLI (optionnel)

```bash
npm i -g vercel
vercel login
vercel link
vercel env add SESSION_SECRET production
vercel --prod
```

La CLI permet de gérer les variables sans passer par l'interface web.

---

## 12. Checklist finale

- [ ] `package.json` à la racine avec les scripts `dev`, `build`, `start`.
- [ ] `app/layout.js` et `app/page.js` présents.
- [ ] `npm run build` passe en local sans erreur.
- [ ] `supabase/schema.sql` exécuté sur le projet de production.
- [ ] Toutes les variables obligatoires saisies dans Vercel.
- [ ] `NEXT_PUBLIC_SITE_URL` et `DISCORD_REDIRECT_URI` alignés sur le domaine final.
- [ ] URL de callback déclarée dans le Discord Developer Portal.
- [ ] Redéploiement effectué après les changements de variables.
- [ ] `/api/health` renvoie `200` avec `"database": "ok"`.
- [ ] Connexion Discord testée de bout en bout.
