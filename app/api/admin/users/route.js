import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ACTIONS = {
  ban: { is_banned: true },
  unban: { is_banned: false },
  promote: { role: "admin" },
  demote: { role: "user" },
};

/** Gestion des comptes utilisateurs (bannissement / rôle). */
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

  const { id, action } = body || {};
  if (!id || !ACTIONS[action]) return fail("Action invalide.", 400);
  if (id === admin.id && ["ban", "demote"].includes(action)) {
    return fail("Vous ne pouvez pas modifier votre propre compte.", 400);
  }

  const updated = await db().updateUser(id, ACTIONS[action]);
  if (!updated) return fail("Utilisateur introuvable.", 404);

  return json({
    ok: true,
    user: {
      id: updated.id,
      is_banned: updated.is_banned,
      role: updated.role,
    },
  });
}
