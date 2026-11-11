import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Vue d'ensemble réservée aux administrateurs. */
export async function GET() {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);
  if (!user.is_admin) return fail("Accès refusé.", 403);

  const [stats, users, adViews, withdrawals] = await Promise.all([
    db().getStats(),
    db().listUsers(),
    db().listAdViews({ limit: 200 }),
    db().listWithdrawals({ limit: 200 }),
  ]);

  return json({
    demo: isDemoMode(),
    stats,
    users,
    adViews,
    withdrawals,
  });
}
