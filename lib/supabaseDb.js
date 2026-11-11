import { getSupabaseAdmin } from "./supabase";

function sb() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase n'est pas configuré.");
  return client;
}

/** Aplatit la jointure users + wallets en un objet unique. */
function mapUser(row) {
  if (!row) return null;
  const wallet = Array.isArray(row.wallets) ? row.wallets[0] : row.wallets;
  const { wallets, ...rest } = row;
  return {
    ...rest,
    balance_cents: wallet?.balance_cents ?? 0,
    total_earned_cents: wallet?.total_earned_cents ?? 0,
  };
}

const USER_SELECT = "*, wallets(balance_cents, total_earned_cents)";

export const supabaseStore = {
  demo: false,

  getOffers() {
    return sb()
      .from("ad_campaigns")
      .select("*")
      .eq("is_active", true)
      .order("reward_cents", { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      });
  },

  async getUserById(id) {
    const { data, error } = await sb()
      .from("users")
      .select(USER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return mapUser(data);
  },

  async getUserByDiscordId(discordId) {
    const { data, error } = await sb()
      .from("users")
      .select(USER_SELECT)
      .eq("discord_id", String(discordId))
      .maybeSingle();
    if (error) throw error;
    return mapUser(data);
  },

  async upsertDiscordUser(profile) {
    const { data, error } = await sb()
      .from("users")
      .upsert(
        {
          discord_id: String(profile.discord_id),
          username: profile.username,
          display_name: profile.display_name || profile.username,
          avatar: profile.avatar || null,
          email: profile.email || null,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: "discord_id" }
      )
      .select("id")
      .single();
    if (error) throw error;

    // S'assure qu'un portefeuille existe (idempotent).
    await sb()
      .from("wallets")
      .upsert({ user_id: data.id }, { onConflict: "user_id", ignoreDuplicates: true });

    return this.getUserById(data.id);
  },

  async listUsers() {
    const { data, error } = await sb()
      .from("users")
      .select(USER_SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data || []).map(mapUser);
  },

  async updateUser(id, patch) {
    const { data, error } = await sb()
      .from("users")
      .update(patch)
      .eq("id", id)
      .select(USER_SELECT)
      .maybeSingle();
    if (error) throw error;
    return mapUser(data);
  },

  async getWallet(userId) {
    const { data, error } = await sb()
      .from("wallets")
      .select("balance_cents, total_earned_cents")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data || { balance_cents: 0, total_earned_cents: 0 };
  },

  async listAdViews({ userId, limit = 50 } = {}) {
    let query = sb()
      .from("ad_views")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createAdView({ userId, offer, ip, userAgent, sessionToken }) {
    const { data, error } = await sb()
      .from("ad_views")
      .insert({
        user_id: userId,
        offer_id: String(offer.id),
        ad_title: offer.title,
        reward_cents: offer.reward_cents || 0,
        status: "pending",
        session_token: sessionToken,
        ip: ip || null,
        user_agent: userAgent || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async getAdViewByToken(token) {
    const { data, error } = await sb()
      .from("ad_views")
      .select("*")
      .eq("session_token", token)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async setAdViewStatus(token, status) {
    const patch = { status };
    if (status === "awaiting_confirmation") patch.finished_at = new Date().toISOString();
    const { data, error } = await sb()
      .from("ad_views")
      .update(patch)
      .eq("session_token", token)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async validateAdViewByToken(token, { reference, revenueCents }) {
    const { data, error } = await sb().rpc("credit_ad_view", {
      p_token: token,
      p_reference: reference || null,
      p_revenue_cents: Math.max(Number(revenueCents) || 0, 0),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: Boolean(row?.ok),
      reason: row?.ok ? undefined : row?.status,
      balance_cents: row?.balance_cents ?? null,
    };
  },

  async listWithdrawals({ userId, limit = 100 } = {}) {
    let query = sb()
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createWithdrawal({ userId, amountCents, method, destination, ticketUrl }) {
    const { data, error } = await sb().rpc("request_withdrawal", {
      p_user_id: userId,
      p_amount: amountCents,
      p_method: method,
      p_destination: destination,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      return { ok: false, reason: row?.reason || "error", balance_cents: row?.balance_cents ?? null };
    }
    if (ticketUrl) {
      await sb().from("withdrawals").update({ ticket_url: ticketUrl }).eq("id", row.withdrawal_id);
    }
    const { data: wd } = await sb()
      .from("withdrawals")
      .select("*")
      .eq("id", row.withdrawal_id)
      .maybeSingle();
    return { ok: true, withdrawal: wd, balance_cents: row.balance_cents };
  },

  async updateWithdrawal(id, patch, { refund = false } = {}) {
    if (refund && patch.status === "rejected") {
      const { data, error } = await sb().rpc("reject_withdrawal", {
        p_id: id,
        p_admin: patch.processed_by || null,
        p_note: patch.note || null,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    }
    const { data, error } = await sb()
      .from("withdrawals")
      .update({ ...patch, processed_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getStats() {
    const client = sb();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [usersRes, viewsRes, wdRes] = await Promise.all([
      client.from("users").select("id", { count: "exact", head: true }),
      client
        .from("ad_views")
        .select("reward_cents, status, validated_at")
        .eq("status", "validated"),
      client.from("withdrawals").select("amount_cents, status"),
    ]);
    if (usersRes.error) throw usersRes.error;
    if (viewsRes.error) throw viewsRes.error;
    if (wdRes.error) throw wdRes.error;

    const views = viewsRes.data || [];
    const withdrawals = wdRes.data || [];
    const todayViews = views.filter(
      (v) => v.validated_at && new Date(v.validated_at) >= todayStart
    );

    return {
      users: usersRes.count || 0,
      validatedAds: views.length,
      totalPaidCents: withdrawals
        .filter((w) => w.status === "paid")
        .reduce((s, w) => s + w.amount_cents, 0),
      totalEarnedCents: views.reduce((s, v) => s + v.reward_cents, 0),
      pendingWithdrawals: withdrawals.filter((w) => w.status === "pending").length,
      todayEarnedCents: todayViews.reduce((s, v) => s + v.reward_cents, 0),
      todayValidated: todayViews.length,
    };
  },

  async getTodayForUser(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data, error } = await sb()
      .from("ad_views")
      .select("reward_cents, validated_at")
      .eq("user_id", userId)
      .eq("status", "validated")
      .gte("validated_at", todayStart.toISOString());
    if (error) throw error;
    const views = data || [];
    return {
      earned_cents: views.reduce((s, v) => s + v.reward_cents, 0),
      count: views.length,
    };
  },
};
