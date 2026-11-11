import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Liste les campagnes actuellement disponibles. */
export async function GET() {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  const offers = await db().getOffers();
  return json({
    demo: isDemoMode(),
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      advertiser: o.advertiser,
      category: o.category,
      reward_cents: o.reward_cents,
      duration_seconds: o.duration_seconds,
      network: o.network,
    })),
  });
}
