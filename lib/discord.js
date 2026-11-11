const DISCORD_API = "https://discord.com/api/v10";

export function discordAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify email",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Échange du code Discord échoué (${res.status})`);
  }
  return res.json();
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Récupération du profil Discord échouée (${res.status})`);
  }
  const u = await res.json();
  return {
    discord_id: u.id,
    username: u.username,
    display_name: u.global_name || u.username,
    avatar: u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
      : null,
    email: u.email || null,
  };
}

function sanitizeChannelName(input) {
  return String(input || "ticket")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "ticket";
}

/**
 * Ouvre un salon-ticket privé via l'API REST du bot Discord.
 * Générique : sert aux retraits comme au support.
 */
export async function openTicketChannel({ user, name, topic, title, fields, content }) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const categoryId = process.env.DISCORD_TICKET_CATEGORY_ID;

  if (!token || !guildId) {
    return { ok: false, reason: "bot_not_configured" };
  }

  const channelName = sanitizeChannelName(name || `ticket-${user.username}`);

  const createRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: categoryId || undefined,
      topic: topic || `Ticket ZNK Ads • ${user.discord_id}`,
    }),
  });

  if (!createRes.ok) {
    return { ok: false, reason: `discord_error_${createRes.status}` };
  }
  const channel = await createRes.json();

  const embed = {
    title: title || "Ticket ZNK Ads",
    color: 0x8b5cf6,
    fields: fields || [],
    footer: { text: "ZNK Ads" },
    timestamp: new Date().toISOString(),
  };

  await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content:
        content || `<@${user.discord_id}> — un membre de l'équipe va te répondre ici.`,
      embeds: [embed],
    }),
  }).catch(() => {});

  return {
    ok: true,
    channelId: channel.id,
    url: `https://discord.com/channels/${guildId}/${channel.id}`,
  };
}
