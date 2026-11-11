import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AD_SESSION_TTL_SECONDS } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Interroge l'état d'une vue (en attente de la confirmation de la régie). */
export async function GET(request) {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  const token = new URL(request.url).searchParams.get("token");
  if (!token) return fail("Token manquant.", 400);

  const view = await db().getAdViewByToken(token);
  if (!view || view.user_id !== user.id) {
    return fail("Publicité introuvable.", 404);
  }

  if (
    view.status === "pending" &&
    Date.now() - new Date(view.created_at).getTime() > AD_SESSION_TTL_SECONDS * 1000
  ) {
    await db().setAdViewStatus(token, "expired");
    view.status = "expired";
  }

  const wallet = await db().getWallet(user.id);

  return json({
    status: view.status,
    reward_cents: view.reward_cents,
    network_reference: view.network_reference,
    balance_cents: wallet?.balance_cents ?? 0,
  });
}
