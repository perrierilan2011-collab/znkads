/**
 * MODE DÉMONSTRATION — données 100% fictives, stockées en mémoire.
 *
 * ⚠️  Aucun gain réel n'est généré ici. Les montants servent uniquement
 *     à illustrer l'interface. Ils sont réinitialisés à chaque redémarrage
 *     du serveur et sont clairement identifiés comme fictifs dans l'UI.
 */

const DEMO_FLAG = true;

function iso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function uid() {
  return crypto.randomUUID();
}

function seed() {
  const now = Date.now();

  const users = [
    {
      id: "demo-user-0001",
      discord_id: "1071234567890123456",
      username: "NovaDemo",
      display_name: "Nova (démo)",
      avatar: null,
      email: null,
      role: "user",
      is_banned: false,
      created_at: iso(-1000 * 60 * 60 * 24 * 42),
      last_login_at: iso(-1000 * 60 * 12),
      balance_cents: 1240,
      total_earned_cents: 4890,
    },
    {
      id: "demo-admin-0001",
      discord_id: "100000000000000001",
      username: "znk_staff",
      display_name: "ZNK Staff (démo)",
      avatar: null,
      email: null,
      role: "admin",
      is_banned: false,
      created_at: iso(-1000 * 60 * 60 * 24 * 120),
      last_login_at: iso(-1000 * 60 * 60 * 3),
      balance_cents: 0,
      total_earned_cents: 0,
    },
    {
      id: "demo-user-0002",
      discord_id: "112233445566778899",
      username: "PixelFox",
      display_name: "PixelFox (démo)",
      avatar: null,
      email: null,
      role: "user",
      is_banned: false,
      created_at: iso(-1000 * 60 * 60 * 24 * 30),
      last_login_at: iso(-1000 * 60 * 60 * 5),
      balance_cents: 2750,
      total_earned_cents: 8130,
    },
    {
      id: "demo-user-0003",
      discord_id: "223344556677889900",
      username: "AriaStream",
      display_name: "Aria (démo)",
      avatar: null,
      email: null,
      role: "user",
      is_banned: false,
      created_at: iso(-1000 * 60 * 60 * 24 * 12),
      last_login_at: iso(-1000 * 60 * 60 * 30),
      balance_cents: 640,
      total_earned_cents: 1520,
    },
    {
      id: "demo-user-0004",
      discord_id: "334455667788990011",
      username: "KryptoKid",
      display_name: "KryptoKid (démo)",
      avatar: null,
      email: null,
      role: "user",
      is_banned: false,
      created_at: iso(-1000 * 60 * 60 * 24 * 60),
      last_login_at: iso(-1000 * 60 * 60 * 2),
      balance_cents: 5120,
      total_earned_cents: 12400,
    },
    {
      id: "demo-user-0005",
      discord_id: "445566778899001122",
      username: "MiloPlay",
      display_name: "Milo (démo)",
      avatar: null,
      email: null,
      role: "user",
      is_banned: true,
      created_at: iso(-1000 * 60 * 60 * 24 * 8),
      last_login_at: iso(-1000 * 60 * 60 * 24 * 3),
      balance_cents: 0,
      total_earned_cents: 340,
    },
  ];

  const offers = [
    {
      id: "demo_ad_hosting",
      title: "Découvrez Nova Host — hébergement gaming",
      advertiser: "Nova Host (démo)",
      category: "Services",
      reward_cents: 12,
      duration_seconds: 30,
      network: "DemoAdNetwork",
    },
    {
      id: "demo_ad_survey",
      title: "Sondage éclair — habitudes de jeu",
      advertiser: "StatPanel (démo)",
      category: "Sondage",
      reward_cents: 8,
      duration_seconds: 20,
      network: "DemoAdNetwork",
    },
    {
      id: "demo_ad_video",
      title: "Vidéo partenaire — 45 secondes",
      advertiser: "ReelAds (démo)",
      category: "Vidéo",
      reward_cents: 20,
      duration_seconds: 45,
      network: "DemoAdNetwork",
    },
    {
      id: "demo_ad_app",
      title: "Installez l'application FitRun",
      advertiser: "FitRun (démo)",
      category: "Application",
      reward_cents: 15,
      duration_seconds: 25,
      network: "DemoAdNetwork",
    },
  ];

  const adViews = [
    mkView("demo-user-0001", offers[0], "validated", -1000 * 60 * 25, 12),
    mkView("demo-user-0001", offers[1], "validated", -1000 * 60 * 62, 8),
    mkView("demo-user-0001", offers[2], "validated", -1000 * 60 * 60 * 20, 20),
    mkView("demo-user-0001", offers[0], "validated", -1000 * 60 * 60 * 26, 12),
    mkView("demo-user-0001", offers[3], "awaiting_confirmation", -1000 * 60 * 40, 15),
    mkView("demo-user-0002", offers[2], "validated", -1000 * 60 * 90, 20),
    mkView("demo-user-0002", offers[0], "validated", -1000 * 60 * 60 * 6, 12),
    mkView("demo-user-0003", offers[1], "validated", -1000 * 60 * 60 * 4, 8),
    mkView("demo-user-0004", offers[3], "validated", -1000 * 60 * 60 * 9, 15),
    mkView("demo-user-0005", offers[0], "rejected", -1000 * 60 * 60 * 30, 12),
  ];

  const withdrawals = [
    {
      id: "demo-wd-0001",
      user_id: "demo-user-0001",
      amount_cents: 500,
      method: "paypal",
      destination: "nova.demo@example.com",
      status: "pending",
      note: null,
      ticket_url: null,
      created_at: iso(-1000 * 60 * 60 * 6),
      processed_at: null,
      processed_by: null,
    },
    {
      id: "demo-wd-0002",
      user_id: "demo-user-0001",
      amount_cents: 1000,
      method: "crypto",
      destination: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
      status: "paid",
      note: "Payé via Binance Pay",
      ticket_url: null,
      created_at: iso(-1000 * 60 * 60 * 24 * 9),
      processed_at: iso(-1000 * 60 * 60 * 24 * 8),
      processed_by: "demo-admin-0001",
    },
    {
      id: "demo-wd-0003",
      user_id: "demo-user-0002",
      amount_cents: 1500,
      method: "paypal",
      destination: "pixelfox@example.com",
      status: "pending",
      note: null,
      ticket_url: null,
      created_at: iso(-1000 * 60 * 60 * 3),
      processed_at: null,
      processed_by: null,
    },
    {
      id: "demo-wd-0004",
      user_id: "demo-user-0004",
      amount_cents: 3000,
      method: "crypto",
      destination: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      status: "approved",
      note: "En cours de traitement",
      ticket_url: null,
      created_at: iso(-1000 * 60 * 60 * 28),
      processed_at: iso(-1000 * 60 * 60 * 20),
      processed_by: "demo-admin-0001",
    },
  ];

  return { users, offers, adViews, withdrawals };
}

function mkView(userId, offer, status, createdAtOffset, rewardCents) {
  return {
    id: uid(),
    user_id: userId,
    offer_id: offer.id,
    ad_title: offer.title,
    advertiser: offer.advertiser,
    reward_cents: rewardCents,
    status,
    session_token: `demo_${uid()}`,
    network_reference: status === "validated" ? `DEMO-REF-${uid().slice(0, 8)}` : null,
    created_at: iso(createdAtOffset),
    finished_at: status === "pending" ? null : iso(createdAtOffset + 1000 * 30),
    validated_at: status === "validated" ? iso(createdAtOffset + 1000 * 35) : null,
    ip: "203.0.113.10",
    user_agent: "Demo/1.0",
  };
}

function getStore() {
  const g = globalThis;
  if (!g.__ZNK_DEMO_STORE__) {
    g.__ZNK_DEMO_STORE__ = seed();
  }
  return g.__ZNK_DEMO_STORE__;
}

/* ------------------------------------------------------------------ */
/*  Interface publique (identique au store Supabase)                   */
/* ------------------------------------------------------------------ */

export const demoStore = {
  demo: DEMO_FLAG,

  getOffers() {
    return getStore().offers.map((o) => ({ ...o }));
  },

  getUserById(id) {
    return getStore().users.find((u) => u.id === id) || null;
  },

  getUserByDiscordId(discordId) {
    return (
      getStore().users.find((u) => u.discord_id === String(discordId)) || null
    );
  },

  upsertDiscordUser(profile) {
    const store = getStore();
    let user = store.users.find(
      (u) => u.discord_id === String(profile.discord_id)
    );
    if (!user) {
      user = {
        id: uid(),
        discord_id: String(profile.discord_id),
        username: profile.username,
        display_name: profile.display_name || profile.username,
        avatar: profile.avatar || null,
        email: profile.email || null,
        role: "user",
        is_banned: false,
        created_at: iso(),
        last_login_at: iso(),
        balance_cents: 0,
        total_earned_cents: 0,
      };
      store.users.push(user);
    } else {
      user.username = profile.username || user.username;
      user.display_name = profile.display_name || user.display_name;
      user.avatar = profile.avatar ?? user.avatar;
      user.email = profile.email ?? user.email;
      user.last_login_at = iso();
    }
    return { ...user };
  },

  listUsers() {
    return getStore()
      .users.slice()
      .sort((a, b) => b.total_earned_cents - a.total_earned_cents)
      .map((u) => ({ ...u }));
  },

  updateUser(id, patch) {
    const store = getStore();
    const user = store.users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    return { ...user };
  },

  getWallet(userId) {
    const user = getStore().users.find((u) => u.id === userId);
    if (!user) return null;
    return {
      balance_cents: user.balance_cents,
      total_earned_cents: user.total_earned_cents,
    };
  },

  listAdViews({ userId, limit = 50 } = {}) {
    return getStore()
      .adViews.filter((v) => (userId ? v.user_id === userId : true))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map((v) => ({ ...v }));
  },

  createAdView({ userId, offer, ip, userAgent, sessionToken }) {
    const view = {
      id: uid(),
      user_id: userId,
      offer_id: offer.id,
      ad_title: offer.title,
      advertiser: offer.advertiser,
      reward_cents: offer.reward_cents,
      status: "pending",
      session_token: sessionToken || `demo_${uid()}`,
      network_reference: null,
      created_at: iso(),
      finished_at: null,
      validated_at: null,
      ip: ip || null,
      user_agent: userAgent || null,
    };
    getStore().adViews.push(view);
    return { ...view };
  },

  getAdViewByToken(token) {
    const v = getStore().adViews.find((x) => x.session_token === token);
    return v ? { ...v } : null;
  },

  setAdViewStatus(token, status) {
    const v = getStore().adViews.find((x) => x.session_token === token);
    if (!v) return null;
    v.status = status;
    if (status === "awaiting_confirmation") v.finished_at = iso();
    return { ...v };
  },

  /** Crédite le portefeuille. Idempotent : un seul crédit par vue. */
  validateAdViewByToken(token, { reference, revenueCents }) {
    const store = getStore();
    const v = store.adViews.find((x) => x.session_token === token);
    if (!v) return { ok: false, reason: "not_found" };
    if (v.status === "validated") {
      const wallet = this.getWallet(v.user_id);
      return { ok: true, alreadyValidated: true, balance_cents: wallet?.balance_cents ?? 0 };
    }
    if (!["pending", "awaiting_confirmation"].includes(v.status)) {
      return { ok: false, reason: v.status };
    }
    const amount = Math.max(Number(revenueCents) || 0, 0);
    v.status = "validated";
    v.reward_cents = amount;
    v.network_reference = reference || null;
    v.validated_at = iso();
    const user = store.users.find((u) => u.id === v.user_id);
    if (user) {
      user.balance_cents += amount;
      user.total_earned_cents += amount;
    }
    return { ok: true, balance_cents: user?.balance_cents ?? 0, credited_cents: amount };
  },

  listWithdrawals({ userId, limit = 100 } = {}) {
    return getStore()
      .withdrawals.filter((w) => (userId ? w.user_id === userId : true))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map((w) => ({ ...w }));
  },

  createWithdrawal({ userId, amountCents, method, destination, ticketUrl }) {
    const store = getStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) return { ok: false, reason: "user_not_found" };
    if (user.balance_cents < amountCents) {
      return { ok: false, reason: "insufficient_funds", balance_cents: user.balance_cents };
    }
    user.balance_cents -= amountCents;
    const wd = {
      id: uid(),
      user_id: userId,
      amount_cents: amountCents,
      method,
      destination,
      status: "pending",
      note: null,
      ticket_url: ticketUrl || null,
      created_at: iso(),
      processed_at: null,
      processed_by: null,
    };
    store.withdrawals.push(wd);
    return { ok: true, withdrawal: { ...wd }, balance_cents: user.balance_cents };
  },

  updateWithdrawal(id, patch, { refund = false } = {}) {
    const store = getStore();
    const wd = store.withdrawals.find((w) => w.id === id);
    if (!wd) return null;
    const wasPending = wd.status === "pending" || wd.status === "approved";
    Object.assign(wd, patch, { processed_at: iso() });
    if (refund && wasPending && wd.status === "rejected") {
      const user = store.users.find((u) => u.id === wd.user_id);
      if (user) user.balance_cents += wd.amount_cents;
    }
    return { ...wd };
  },

  getStats() {
    const store = getStore();
    const validated = store.adViews.filter((v) => v.status === "validated");
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayViews = validated.filter(
      (v) => new Date(v.validated_at || v.created_at) >= todayStart
    );
    return {
      users: store.users.length,
      validatedAds: validated.length,
      totalPaidCents: store.withdrawals
        .filter((w) => w.status === "paid")
        .reduce((s, w) => s + w.amount_cents, 0),
      totalEarnedCents: validated.reduce((s, v) => s + v.reward_cents, 0),
      pendingWithdrawals: store.withdrawals.filter((w) => w.status === "pending").length,
      todayEarnedCents: todayViews.reduce((s, v) => s + v.reward_cents, 0),
      todayValidated: todayViews.length,
    };
  },

  getTodayForUser(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const views = getStore().adViews.filter(
      (v) =>
        v.user_id === userId &&
        v.status === "validated" &&
        new Date(v.validated_at || v.created_at) >= todayStart
    );
    return {
      earned_cents: views.reduce((s, v) => s + v.reward_cents, 0),
      count: views.length,
    };
  },
};
