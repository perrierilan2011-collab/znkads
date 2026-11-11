import { json, fail, randomToken, clientIp } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AD_COOLDOWN_SECONDS, AD_SESSION_TTL_SECONDS } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Démarre une session publicitaire. Ne crédite RIEN : attend la régie. */
export async function POST(request) {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  const offers = await db().getOffers();
  if (!offers.length) {
    return fail("Aucune campagne publicitaire disponible pour le moment.", 409, {
      code: "no_offers",
    });
  }

  const recent = await db().listAdViews({ userId: user.id, limit: 5 });
  const now = Date.now();

  const active = recent.find(
    (v) =>
      ["pending", "awaiting_confirmation"].includes(v.status) &&
      now - new Date(v.created_at).getTime() < AD_SESSION_TTL_SECONDS * 1000
  );
  if (active) {
    return fail("Une publicité est déjà en cours.", 409, {
      code: "ad_in_progress",
      token: active.session_token,
    });
  }

  const last = recent[0];
  if (last) {
    const elapsed = (now - new Date(last.created_at).getTime()) / 1000;
    if (elapsed < AD_COOLDOWN_SECONDS) {
      const retryAfter = Math.ceil(AD_COOLDOWN_SECONDS - elapsed);
      return fail(`Patientez ${retryAfter} s avant la prochaine publicité.`, 429, {
        code: "cooldown",
        retryAfter,
      });
    }
  }

  const offer = offers[Math.floor(Math.random() * offers.length)];
  const sessionToken = randomToken(24);

  const view = await db().createAdView({
    userId: user.id,
    offer,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
    sessionToken,
  });

  return json({
    token: view.session_token,
    expiresAt: new Date(now + AD_SESSION_TTL_SECONDS * 1000).toISOString(),
    offer: {
      id: offer.id,
      title: offer.title,
      advertiser: offer.advertiser,
      category: offer.category,
      duration_seconds: offer.duration_seconds,
      reward_cents: offer.reward_cents,
      network: offer.network,
    },
  });
}
