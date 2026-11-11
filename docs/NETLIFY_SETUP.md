# Déploiement Netlify

Le site est hébergé sur Netlify (`https://znkads.netlify.app`). Next.js 15 doit être déployé avec le plugin officiel `@netlify/plugin-nextjs`. Sans lui, Netlify publie un dossier statique vide et **toutes les pages renvoient 404**.

Le fichier `netlify.toml` à la racine du projet contient déjà la configuration nécessaire :

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

## 1. Pourquoi le site renvoie 404

Symptômes constatés :

```text
GET https://znkads.netlify.app/            -> 404
GET https://znkads.netlify.app/login       -> 404
GET https://znkads.netlify.app/api/health  -> 404
```

Causes possibles, dans l'ordre :

1. Le plugin Next.js n'est pas installé → Netlify ne sait pas servir l'App Router.
2. Le **Publish directory** est réglé sur `out` ou `public` au lieu de `.next`.
3. Le **Build command** est vide ou différent de `npm run build`.
4. Le build a échoué et l'ancien déploiement vide est resté en ligne.
5. Les variables d'environnement manquent → le build passe mais les routes échouent.

Le `netlify.toml` fourni corrige les points 1 à 3. Il faut ensuite **redéployer**.

---

## 2. Variables d'environnement Netlify

Netlify → **Site configuration → Environment variables → Add a variable**.

Valeurs de production (domaine Netlify) :

```env
NEXT_PUBLIC_SITE_URL=https://znkads.netlify.app
SUPABASE_URL=https://prstmrsztzdqhaaxctiq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<votre cle secrete Supabase>

DISCORD_CLIENT_ID=<application id Discord>
DISCORD_CLIENT_SECRET=<client secret Discord>
DISCORD_REDIRECT_URI=https://znkads.netlify.app/api/auth/callback

DISCORD_BOT_TOKEN=<token du bot>
BOT_API_SECRET=<secret de 32 caracteres minimum>

DISCORD_WITHDRAWAL_INVITE_URL=https://discord.gg/Rh2vBKzhVC

DAILY_AD_LIMIT=10
AD_REWARD_AMOUNT=0.02
AD_REWARDS_ENABLED=false
AD_PROVIDER=
AD_PROVIDER_SECRET=
AD_PROVIDER_URL=

REFERRAL_SIGNUP_REWARD=0.20
REFERRAL_AD_REWARD=0.80
REFERRAL_REQUIRED_ADS=10

MINIMUM_WITHDRAWAL=5.00
WITHDRAWALS_ENABLED=true
CURRENCY=EUR
SESSION_SECRET=<secret de 32 caracteres minimum>
```

Règles :

- Aucun guillemet autour des valeurs.
- `NEXT_PUBLIC_SITE_URL` sans slash final.
- `DISCORD_REDIRECT_URI` doit être **identique** à l'URL déclarée dans le Discord Developer Portal.
- `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `BOT_API_SECRET` restent côté serveur : ne jamais les préfixer par `NEXT_PUBLIC_`.
- Netlify n'applique les nouvelles variables qu'après un **nouveau déploiement**.

---

## 3. Redéployer proprement

Après avoir ajouté les variables :

1. **Deploys → Trigger deploy → Clear cache and deploy site**.
2. Attendre la fin du build.
3. Vérifier les logs : ils doivent contenir `✓ Compiled successfully` puis l'installation du plugin Next.js.
4. Ouvrir `https://znkads.netlify.app/api/health`.

Réponse attendue :

```json
{
  "ok": true,
  "service": "znk-ads",
  "config": { "valid": true, "missing": [], "errors": [] },
  "database": "ok"
}
```

Si `database` vaut `error`, le schéma Supabase n'est pas exécuté (section 4).

---

## 4. Base de données Supabase

Le projet Supabase répond, mais la table `public.users` n'existe pas encore :

```json
{ "code": "PGRST205", "message": "Could not find the table 'public.users' in the schema cache" }
```

Il faut exécuter le schéma :

1. Ouvrir <https://supabase.com/dashboard/project/prstmrsztzdqhaaxctiq/sql/new>.
2. Copier **tout** le contenu de `supabase/schema.sql`.
3. Cliquer sur **Run**.
4. Vérifier dans **Table Editor** que les 5 tables existent : `users`, `transactions`, `referrals`, `ad_sessions`, `withdrawals`.
5. Recharger `/api/health` : `database` doit passer à `ok`.

> Le script est idempotent : il peut être relancé sans casser les données existantes.

---

## 5. Application Discord

Dans le Discord Developer Portal → **OAuth2 → Redirects**, ajouter :

```text
https://znkads.netlify.app/api/auth/callback
```

Pour tester en local, ajouter aussi :

```text
http://localhost:3000/api/auth/callback
```

Les deux URL peuvent coexister. Celle utilisée dépend de `DISCORD_REDIRECT_URI`.

---

## 6. Checklist

- [ ] `netlify.toml` présent à la racine et versionné.
- [ ] `@netlify/plugin-nextjs` dans `package.json` (devDependencies).
- [ ] Publish directory = `.next` (ou laisser `netlify.toml` imposer la valeur).
- [ ] Toutes les variables saisies dans Netlify.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` valide.
- [ ] `supabase/schema.sql` exécuté.
- [ ] URL de callback ajoutée dans Discord.
- [ ] **Clear cache and deploy site** effectué.
- [ ] `/api/health` renvoie `200` avec `"database": "ok"`.
- [ ] `CONNECTER DISCORD` ouvre bien la page d'autorisation.

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Correction |
| --- | --- | --- |
| 404 sur toutes les pages | Plugin Next.js absent ou publish directory incorrect | Garder `netlify.toml`, redéployer sans cache. |
| `Page not found` Netlify sur `/` | Build vide ou échoué | Lire les logs de build, corriger, redéployer. |
| `Configuration incomplète` | Variables absentes dans Netlify | Ajouter les variables puis redéployer. |
| `database: error` sur `/api/health` | Schéma non exécuté ou clé invalide | Exécuter `supabase/schema.sql`, vérifier la clé. |
| `Invalid OAuth2 redirect_uri` | URL absente dans Discord | Ajouter l'URL exacte, sans slash final. |
| `state_mismatch` | Cookies bloqués ou domaine différent | Tester sur le domaine exact, autoriser les cookies. |
| Les anciennes variables restent actives | Pas de redéploiement | **Clear cache and deploy site**. |
| Fonctions API en 404 | Routes non transformées en fonctions | Vérifier que le plugin est bien installé dans les logs. |
