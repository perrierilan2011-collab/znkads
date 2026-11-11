import { isDemoMode } from "./config";
import { demoStore } from "./demo";
import { supabaseStore } from "./supabaseDb";

/**
 * Point d'accès unique aux données.
 * Bascule automatiquement entre Supabase (production) et le
 * store de démonstration en mémoire.
 */
export function db() {
  return isDemoMode() ? demoStore : supabaseStore;
}

export { isDemoMode };
