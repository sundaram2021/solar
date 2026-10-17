import { createBrowserClient } from "@supabase/ssr";

export function createSolarBrowserClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://ckjrxicboixflqlbpdmi.supabase.co";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_ux6m80vtkJvTuh5G1PejxA_bt5nriRO";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
