/**
 * Gestion de l'argent.
 * Tous les montants sont stockés en CENTIMES (entiers) pour éviter
 * toute erreur d'arrondi liée aux nombres flottants.
 */

export function formatEUR(cents) {
  const value = Number(cents || 0) / 100;
  try {
    return value.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
    });
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

/** Convertit une saisie utilisateur (« 12,50 » ou « 12.50 ») en centimes. */
export function parseEurosToCents(input) {
  if (input === null || input === undefined) return NaN;
  const normalized = String(input).replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return formatDate(value);
}
