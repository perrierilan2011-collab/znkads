import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "approved", "paid", "rejected"];

/** Traitement des demandes de retrait. Un refus recrédite le solde. */
export async function PATCH(request) {
  const admin = await requireUser();
  if (!admin) return fail("Non authentifié.", 401);
  if (!admin.is_admin) return fail("Accès refusé.", 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Requête invalide.", 400);
  }

  const { id, status, note } = body || {};
  if (!id || !STATUSES.includes(status)) {
    return fail("Statut invalide.", 400);
  }

  const updated = await db().updateWithdrawal(
    id,
    {
      status,
      note: typeof note === "string" ? note.slice(0, 500) : null,
      processed_by: admin.id,
    },
    { refund: status === "rejected" }
  );

  if (!updated) return fail("Demande introuvable.", 404);
  return json({ ok: true, withdrawal: updated });
}
