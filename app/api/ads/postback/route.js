import { json, fail } from "@/lib/http";
import { db } from "@/lib/db";
import { hmacHex, timingSafeEqual } from "@/lib/signature";

export const dynamic = "force-dynamic";

/**
 * POSTBACK DE LA RÉGIE PUBLICITAIRE (appel serveur à serveur).
 *
 * C'est le SEUL point du système qui crédite un solde.
 * La régie appelle cette URL une fois la vue réellement validée :
 *   GET/POST /api/ads/postback?token=...&ref=...&revenue=<centimes>&sig=<hmac>
 *
 * Signature attendue : HMAC-SHA256 de `${token}:${ref}:${revenue}`
 * avec le secret AD_NETWORK_POSTBACK_SECRET.
 */
async function handle(request) {
  const secret = process.env.AD_NETWORK_POSTBACK_SECRET;
  if (!secret) {
    return fail("Postback non configuré (AD_NETWORK_POSTBACK_SECRET).", 503);
  }

  const url = new URL(request.url);
  let params = Object.fromEntries(url.searchParams.entries());

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        params = { ...params, ...(await request.json()) };
      } else {
        const form = await request.formData();
        params = { ...params, ...Object.fromEntries(form.entries()) };
      }
    } catch {
      /* on garde les paramètres d'URL */
    }
  }

  const token = params.token;
  const ref = params.ref || "";
  const sig = params.sig;
  const revenueCents = Math.max(parseInt(params.revenue ?? "0", 10) || 0, 0);

  if (!token || !sig) return fail("Paramètres manquants (token, sig).", 400);

  const expected = await hmacHex(secret, `${token}:${ref}:${revenueCents}`);
  if (!timingSafeEqual(expected, sig)) {
    return fail("Signature invalide.", 401);
  }

  const result = await db().validateAdViewByToken(token, {
    reference: ref || null,
    revenueCents,
  });

  if (!result.ok) {
    return fail("Vue non validable.", 409, { reason: result.reason });
  }

  return json({
    ok: true,
    credited_cents: revenueCents,
    balance_cents: result.balance_cents,
  });
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
