import { createServerClient } from "@supabase/ssr";
import { solarEnv } from "./env";

/**
 * Service-role client for background work (polling, sandbox callbacks).
 * Bypasses RLS — always scope queries by user_id manually.
 */
export function createServiceClient() {
  if (!solarEnv.supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  return createServerClient(solarEnv.supabaseUrl, solarEnv.supabaseSecretKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
