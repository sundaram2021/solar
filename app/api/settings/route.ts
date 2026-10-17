import { NextResponse } from "next/server";
import { createSolarServerClient } from "@/lib/supabase-server";

/** Get or update the orchestrator auto-approve automation toggle. */
export async function GET() {
  const supabase = await createSolarServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    settings: (data as object | null) ?? {
      user_id: user.id,
      orchestrator_auto_approve: false,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createSolarServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as {
    orchestrator_auto_approve?: boolean;
  };

  // Explicit update-then-insert: surfaces RLS/schema failures instead of
  // silently "succeeding" while nothing persists.
  const { data: existing } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = {
    user_id: user.id,
    orchestrator_auto_approve: Boolean(body.orchestrator_auto_approve),
  };

  const write = existing
    ? await supabase.from("user_settings").update(row).eq("user_id", user.id).select().single()
    : await supabase.from("user_settings").insert([row]).select().single();

  if (write.error || !write.data) {
    return NextResponse.json(
      { error: write.error?.message ?? "settings write failed" },
      { status: 500 }
    );
  }

  // Read-back verification: prove the values actually persisted.
  const { data: verify, error: verifyError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (verifyError || !verify) {
    return NextResponse.json(
      { error: "settings write not visible — check Row Level Security policies" },
      { status: 500 }
    );
  }
  return NextResponse.json({ settings: verify });
}
