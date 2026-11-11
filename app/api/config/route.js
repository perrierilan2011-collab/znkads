import { json } from "@/lib/http";
import {
  isDemoMode,
  isDiscordConfigured,
  isDiscordBotConfigured,
  MIN_WITHDRAWAL_CENTS,
  WITHDRAWAL_METHODS,
} from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    demo: isDemoMode(),
    discordConfigured: isDiscordConfigured(),
    discordBotConfigured: isDiscordBotConfigured(),
    minWithdrawalCents: MIN_WITHDRAWAL_CENTS,
    methods: WITHDRAWAL_METHODS,
    discordInvite: process.env.NEXT_PUBLIC_DISCORD_INVITE || "",
  });
}
