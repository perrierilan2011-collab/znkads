import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "znk_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

const ALG = "HS256";
const DEV_FALLBACK_SECRET =
  "znk-ads-dev-secret-change-me-in-production-0123456789";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  const value =
    secret && secret.length >= 16 ? secret : DEV_FALLBACK_SECRET;
  return new TextEncoder().encode(value);
}

/** Crée un JWT de session signé (côté serveur uniquement). */
export async function createSession(user) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    discordId: user.discord_id,
    username: user.username,
    displayName: user.display_name || user.username,
    avatar: user.avatar || null,
    role: user.role || "user",
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(user.id))
    .setIssuedAt(now)
    .setExpirationTime("7d")
    .sign(secretKey());
}

/** Vérifie un JWT de session. Renvoie le payload ou null. */
export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
