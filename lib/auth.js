import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "./session";
import { db } from "./db";
import { isConfiguredAdmin } from "./config";

/** Ajoute le drapeau `is_admin` effectif (rôle DB ou ID Discord autorisé). */
export function withEffectiveRole(user) {
  if (!user) return null;
  const isAdmin = user.role === "admin" || isConfiguredAdmin(user.discord_id);
  return { ...user, is_admin: isAdmin };
}

export async function getSessionPayload() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Renvoie l'utilisateur connecté (depuis la base) ou null. */
export async function getCurrentUser() {
  const payload = await getSessionPayload();
  if (!payload?.sub) return null;
  const user = await db().getUserById(payload.sub);
  if (!user) return null;
  return withEffectiveRole(user);
}

/** Renvoie l'utilisateur ou null ; à utiliser dans les routes API. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || user.is_banned) return null;
  return user;
}
