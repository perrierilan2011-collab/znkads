/** Petit client HTTP pour appeler les routes API de ZNK Ads. */

export async function apiFetch(path, options = {}) {
  const { method = "GET", body, ...rest } = options;
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    ...rest,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const error = new Error(data?.error || "Une erreur est survenue.");
    error.status = res.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }
  return data;
}
