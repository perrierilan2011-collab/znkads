import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/config";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Connexion de démonstration (uniquement en mode démo).
 * Ouvre une session avec un compte fictif clairement identifié.
 */
export async function POST(request) {
  if (!isDemoMode()) {
    return fail("La connexion de démonstration est désactivée.", 403);
  }

  let as = "user";
  try {
    const body = await request.json();
    if (body?.as === "admin") as = "admin";
  } catch {
    /* corps vide accepté */
  }

  const id = as === "admin" ? "demo-admin-0001" : "demo-user-0001";
  const user = await db().getUserById(id);
  if (!user) return fail("Compte de démonstration introuvable.", 404);

  const jwt = await createSession(user);
  const res = NextResponse.json({
    ok: true,
    demo: true,
    user: { id: user.id, username: user.username, is_admin: user.is_admin },
  });
  res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
  return res;
}
