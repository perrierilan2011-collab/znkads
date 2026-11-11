import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Le visionnage est terminé côté client.
 * On passe la vue en « awaiting_confirmation » : le solde n'est PAS crédité.
 * Seul le postback signé de la régie déclenche le crédit.
 */
export async function POST(request) {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  let token;
  try {
    ({ token } = await request.json());
  } catch {
    return fail("Requête invalide.", 400);
  }
  if (!token) return fail("Token manquant.", 400);

  const view = await db().getAdViewByToken(token);
  if (!view || view.user_id !== user.id) {
    return fail("Publicité introuvable.", 404);
  }
  if (view.status === "validated") return json({ status: "validated" });
  if (view.status !== "pending") return json({ status: view.status });

  const updated = await db().setAdViewStatus(token, "awaiting_confirmation");
  return json({ status: updated?.status || "awaiting_confirmation" });
}
