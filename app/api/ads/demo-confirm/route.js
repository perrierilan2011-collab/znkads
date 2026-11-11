import { json, fail, randomToken } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * ⚠️ MODE DÉMONSTRATION UNIQUEMENT.
 * Simule la confirmation de la régie publicitaire pour illustrer le flux.
 * En production, seul le postback signé (/api/ads/postback) crédite un solde.
 */
export async function POST(request) {
  if (!isDemoMode()) {
    return fail("Réservé au mode démonstration.", 403);
  }

  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  let token;
  try {
    ({ token } = await request.json());
  } catch {
    return fail("Requête invalide.", 400);
  }

  const view = await db().getAdViewByToken(token);
  if (!view || view.user_id !== user.id) {
    return fail("Publicité introuvable.", 404);
  }

  if (view.status === "validated") {
    const wallet = await db().getWallet(user.id);
    return json({ status: "validated", balance_cents: wallet.balance_cents, demo: true });
  }

  const result = await db().validateAdViewByToken(token, {
    reference: `DEMO-${randomToken(4).toUpperCase()}`,
    revenueCents: view.reward_cents,
  });

  return json({
    demo: true,
    status: result.ok ? "validated" : view.status,
    balance_cents: result.balance_cents,
  });
}
