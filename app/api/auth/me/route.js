import { json } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null, demo: isDemoMode() });
  return json({
    demo: isDemoMode(),
    user: {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar,
      role: user.role,
      is_admin: user.is_admin,
      is_banned: user.is_banned,
      balance_cents: user.balance_cents,
      total_earned_cents: user.total_earned_cents,
      created_at: user.created_at,
    },
  });
}
