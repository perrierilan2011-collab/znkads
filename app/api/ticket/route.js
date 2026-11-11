import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { openTicketChannel } from "@/lib/discord";
import { isDiscordBotConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Ouvre un ticket Discord de support (hors demande de retrait). */
export async function POST(request) {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  if (!isDiscordBotConfigured()) {
    return fail("Le bot Discord n'est pas configuré.", 503, {
      code: "bot_not_configured",
    });
  }

  let subject = "Support général";
  try {
    const body = await request.json();
    if (typeof body?.subject === "string" && body.subject.trim()) {
      subject = body.subject.trim().slice(0, 120);
    }
  } catch {
    /* corps optionnel */
  }

  const ticket = await openTicketChannel({
    user,
    name: `support-${user.username}`,
    topic: `Support • ${user.discord_id}`,
    title: "Ticket de support — ZNK Ads",
    fields: [
      { name: "Utilisateur", value: `<@${user.discord_id}>`, inline: true },
      { name: "Identifiant", value: `\`${user.discord_id}\``, inline: true },
      { name: "Sujet", value: subject, inline: false },
    ],
  });

  if (!ticket.ok) {
    return fail("Impossible d'ouvrir le ticket Discord.", 502, {
      reason: ticket.reason,
    });
  }

  return json({ ok: true, url: ticket.url });
}
