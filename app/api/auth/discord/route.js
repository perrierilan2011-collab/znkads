import { NextResponse } from "next/server";
import { discordAuthorizeUrl } from "@/lib/discord";
import { isDiscordConfigured } from "@/lib/config";
import { randomToken } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=discord_not_configured", request.url)
    );
  }

  const state = randomToken(16);
  const res = NextResponse.redirect(discordAuthorizeUrl(state));
  res.cookies.set("znk_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
