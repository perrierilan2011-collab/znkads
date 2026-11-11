import { NextResponse } from "next/server";
import { exchangeDiscordCode, fetchDiscordUser } from "@/lib/discord";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

function loginError(request, reason) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(reason)}`, request.url)
  );
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("znk_oauth_state")?.value;

  if (!code) return loginError(request, "missing_code");
  if (!state || !cookieState || state !== cookieState) {
    return loginError(request, "invalid_state");
  }

  try {
    const token = await exchangeDiscordCode(code);
    const profile = await fetchDiscordUser(token.access_token);
    const user = await db().upsertDiscordUser(profile);

    if (user.is_banned) return loginError(request, "account_banned");

    const jwt = await createSession(user);
    const res = NextResponse.redirect(new URL("/dashboard", request.url));
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
    res.cookies.delete("znk_oauth_state");
    return res;
  } catch (err) {
    console.error("[auth/discord/callback]", err);
    return loginError(request, "oauth_failed");
  }
}
