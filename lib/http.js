import { NextResponse } from "next/server";

export function json(data, init) {
  return NextResponse.json(data, init);
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Adresse IP du client (derrière un proxy / Vercel). */
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || null;
}

/** Petite aide pour générer un token aléatoire sûr. */
export function randomToken(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
