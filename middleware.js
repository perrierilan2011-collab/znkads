import { NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "./lib/session";

/**
 * Protège les pages privées. La vérification fine (rôle, bannissement)
 * est refaite côté serveur dans chaque route API.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);

  if (!payload) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ads/:path*",
    "/withdrawals/:path*",
    "/admin/:path*",
  ],
};
