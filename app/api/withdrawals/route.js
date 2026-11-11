import { json, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemoMode, MIN_WITHDRAWAL_CENTS, WITHDRAWAL_METHODS } from "@/lib/config";
import { formatEUR, parseEurosToCents } from "@/lib/money";
import { openTicketChannel } from "@/lib/discord";
import { isDiscordBotConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  const withdrawals = await db().listWithdrawals({ userId: user.id, limit: 100 });
  const wallet = await db().getWallet(user.id);

  return json({
    demo: isDemoMode(),
    balance_cents: wallet?.balance_cents ?? 0,
    total_earned_cents: wallet?.total_earned_cents ?? 0,
    minWithdrawalCents: MIN_WITHDRAWAL_CENTS,
    methods: WITHDRAWAL_METHODS,
    botConfigured: isDiscordBotConfigured(),
    withdrawals,
  });
}

export async function POST(request) {
  const user = await requireUser();
  if (!user) return fail("Non authentifié.", 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Requête invalide.", 400);
  }

  const amountCents = parseEurosToCents(body.amount);
  const method = String(body.method || "");
  const destination = String(body.destination || "").trim();

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return fail("Montant invalide.", 400);
  }
  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    return fail(`Le montant minimum est de ${formatEUR(MIN_WITHDRAWAL_CENTS)}.`, 400);
  }
  if (!WITHDRAWAL_METHODS.some((m) => m.value === method)) {
    return fail("Méthode de retrait invalide.", 400);
  }
  if (destination.length < 3 || destination.length > 200) {
    return fail("Destination invalide.", 400);
  }

  const result = await db().createWithdrawal({
    userId: user.id,
    amountCents,
    method,
    destination,
  });

  if (!result.ok) {
    if (result.reason === "insufficient_funds") {
      return fail("Solde insuffisant.", 400);
    }
    return fail("Impossible de créer la demande.", 400);
  }

  // Ouverture du ticket Discord (best effort : n'échoue pas la demande).
  let ticket = null;
  if (isDiscordBotConfigured()) {
    try {
      ticket = await openTicketChannel({
        user,
        name: `retrait-${user.username}-${String(result.withdrawal.id).slice(0, 6)}`,
        topic: `Retrait • ${user.discord_id}`,
        title: "Demande de retrait — ZNK Ads",
        fields: [
          {
            name: "Utilisateur",
            value: `<@${user.discord_id}> (\`${user.username}\`)`,
            inline: false,
          },
          { name: "Montant", value: formatEUR(amountCents), inline: true },
          { name: "Méthode", value: method, inline: true },
          { name: "Destination", value: `\`${destination}\``, inline: false },
          { name: "Référence", value: `\`${result.withdrawal.id}\``, inline: false },
        ],
      });
      if (ticket?.ok && ticket.url) {
        await db().updateWithdrawal(result.withdrawal.id, { ticket_url: ticket.url });
        result.withdrawal.ticket_url = ticket.url;
      }
    } catch (err) {
      console.error("[withdrawals] ticket Discord", err);
    }
  }

  return json({
    ok: true,
    withdrawal: result.withdrawal,
    balance_cents: result.balance_cents,
    ticket,
  });
}
