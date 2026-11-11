/**
 * Configuration globale de ZNK Ads.
 * Le mode démonstration s'active automatiquement dès que Supabase
 * n'est pas configuré, ou manuellement via DEMO_MODE=true.
 */

export const APP_NAME = "ZNK Ads";
export const APP_TAGLINE = "Regarde. Valide. Encaisse.";

export function isDemoMode() {
  if (
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ) {
    return true;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !url || !key;
}

export function isDiscordConfigured() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
  );
}

export function isDiscordBotConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID);
}

/** Montant minimum de retrait, en centimes. */
export const MIN_WITHDRAWAL_CENTS = Number(
  process.env.MIN_WITHDRAWAL_CENTS || 500
);

/** Durée de validité d'une session publicitaire (le temps de regarder). */
export const AD_SESSION_TTL_SECONDS = 15 * 60;

/** Délai minimum entre deux publicités. */
export const AD_COOLDOWN_SECONDS = 20;

/** Une seule publicité « en cours » à la fois par utilisateur. */
export const MAX_PENDING_ADS = 1;

/** Identifiants Discord ayant les droits d'administration. */
export const ADMIN_DISCORD_IDS = (process.env.ADMIN_DISCORD_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isConfiguredAdmin(discordId) {
  return Boolean(discordId) && ADMIN_DISCORD_IDS.includes(String(discordId));
}

/** Méthodes de retrait supportées. */
export const WITHDRAWAL_METHODS = [
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Crypto (USDT / BTC)" },
  { value: "voucher", label: "Bon d'achat" },
];

export function methodLabel(value) {
  return WITHDRAWAL_METHODS.find((m) => m.value === value)?.label || value;
}
