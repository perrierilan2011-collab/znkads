import { json } from "@/lib/http";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Statistiques agrégées publiques (page d'accueil). */
export async function GET() {
  try {
    const stats = await db().getStats();
    return json({
      users: stats.users,
      validatedAds: stats.validatedAds,
      totalPaidCents: stats.totalPaidCents,
      todayValidated: stats.todayValidated,
    });
  } catch (err) {
    console.error("[api/stats]", err);
    return json({ users: 0, validatedAds: 0, totalPaidCents: 0, todayValidated: 0 });
  }
}
