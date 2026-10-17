/**
 * Centralized server-side environment access.
 * Never import this from client components — keys here are secret.
 */

function clean(value: string | undefined, fallback = ""): string {
  if (!value) return fallback;
  // .env.local values may be wrapped in single/double quotes (e.g. AI_MODEL_NAME='...')
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export const solarEnv = {
  get anthropicApiKey(): string {
    return clean(process.env.AI_API_KEY);
  },
  /** Verified at runtime against Anthropic's model list; falls back safely. */
  get aiModel(): string {
    return clean(process.env.AI_MODEL_NAME, "claude-haiku-4-5") || "claude-haiku-4-5";
  },
  get armoriqApiKey(): string {
    return clean(process.env.ARMORIQ_API_KEY);
  },
  /** Shared secret for the Render cron jobs hitting /api/github/poll and /api/cron/reaper. */
  get cronSecret(): string {
    return clean(process.env.CRON_SECRET);
  },
  /** Optional: fallback end-user email for Armoriq intent attribution. */
  get armoriqUserEmail(): string {
    return clean(process.env.ARMORIQ_USER_EMAIL);
  },
  get exaApiKey(): string {
    return clean(process.env.EXA_API_KEY);
  },
  get tensorlakeApiKey(): string {
    return clean(process.env.TENSORLAKE_API_KEY);
  },
  get tensorlakeMock(): boolean {
    return clean(process.env.TENSORLAKE_MOCK).toLowerCase() === "true";
  },
  get supabaseUrl(): string {
    return (
      clean(process.env.SUPABASE_URL) ||
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
      "https://ckjrxicboixflqlbpdmi.supabase.co"
    );
  },
  get supabaseSecretKey(): string {
    return clean(process.env.SUPABASE_SECRET_KEY);
  },
};

export function assertServerEnv(): void {
  const missing: string[] = [];
  if (!solarEnv.anthropicApiKey) missing.push("AI_API_KEY");
  if (!solarEnv.supabaseSecretKey) missing.push("SUPABASE_SECRET_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing required server env vars: ${missing.join(", ")}`);
  }
}
