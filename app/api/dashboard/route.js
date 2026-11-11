import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  const [views, withdrawals, today] = await Promise.all([
    db().listAdViews({ userId: user.id, limit: 200 }),
    db().listWithdrawals({ userId: user.id, limit: 10 }),
    db().getTodayForUser(user.id),
  ]);

  const counts = {
    validated: views.filter((v) => v.status === "validated").length,
    awaiting: views.filter((v) => v.status === "awaiting_confirmation").length,
    pending: views.filter((v) => v.status === "pending").length,
  };

  return json({
    demo: isDemoMode(),
    user: {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar,
      is_admin: user.is_admin,
      created_at: user.created_at,
    },
    wallet: {
      balance_cents: user.balance_cents,
      total_earned_cents: user.total_earned_cents,
    },
    today,
    counts,
    activity: views.slice(0, 12),
    withdrawals: withdrawals.slice(0, 5),
  });
}
