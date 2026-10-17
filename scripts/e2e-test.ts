/**
 * Solar end-to-end workflow test — REAL services, REAL repo.
 * Target repo: https://github.com/sundaram2021/testing-ao
 *
 * Run: bun scripts/e2e-test.ts
 * Tests: Anthropic classify → customized prompt build → TensorLake sandbox
 * (clone + exec + destroy) → Armoriq intent allowlist → Supabase schema check.
 */
import { readFileSync, writeFileSync } from "fs";

// --- load .env.local (bun does not auto-load it) ---
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

import { classifyWork } from "../lib/orchestrator/classify";
import { buildSystemPrompt } from "../lib/orchestrator/prompts";
import {
  createSandbox,
  sandboxExec,
  destroySandbox,
} from "../lib/sandbox/tensorlake";
import { allowedToolsForKind, isGuardrailsConfigured } from "../lib/guardrails/armoriq";

interface StepResult {
  step: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
}
const results: StepResult[] = [];
function record(step: string, status: StepResult["status"], detail: string) {
  results.push({ step, status, detail });
  console.log(`[${status}] ${step} — ${detail}`);
}

// Minimal Supabase REST client (checks tables exist; no js lib needed).
const SB_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SECRET_KEY || "";
async function sbGet(table: string, query = "select=*&limit=1") {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
}

const TEST_REPO = "sundaram2021/testing-ao";

async function main() {
  // 1. GitHub: target repo reachable?
  try {
    const res = await fetch(`https://api.github.com/repos/${TEST_REPO}`);
    record("github-repo", res.ok ? "PASS" : "FAIL", `GET repos/${TEST_REPO} → ${res.status}`);
  } catch (e) {
    record("github-repo", "FAIL", (e as Error).message);
  }

  // 2. Supabase schema (migration applied?)
  const tables = [
    "github_connections",
    "github_events",
    "sub_agents",
    "chat_threads",
    "approvals",
    "intent_plans",
    "intent_violations",
    "user_settings",
  ];
  for (const t of tables) {
    try {
      const r = await sbGet(t);
      record(`schema:${t}`, r.ok ? "PASS" : "FAIL", `HTTP ${r.status} ${r.ok ? "" : r.body}`);
    } catch (e) {
      record(`schema:${t}`, "FAIL", (e as Error).message);
    }
  }
  // run_log column present?
  try {
    const r = await sbGet("sub_agents", "select=id,run_log,blocked_reason&limit=1");
    record("schema:sub_agents.v2", r.ok ? "PASS" : "FAIL", `run_log+blocked_reason → HTTP ${r.status}${r.ok ? "" : " " + r.body}`);
  } catch (e) {
    record("schema:sub_agents.v2", "FAIL", (e as Error).message);
  }

  // Fake supabase client for prompt lookups (REST-backed).
  const fakeSb = {
    from: (_table: string) => ({
      select: () => ({
        eq: async () => ({ data: null }),
        single: async () => ({ data: null }),
        in: async () => ({ data: [] as unknown[] }),
      }),
      insert: async () => ({ data: null, error: null }),
      update: async () => ({ eq: async () => ({}) }),
      upsert: async () => ({}),
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = fakeSb as any;

  // 3. Classify a synthetic testing-ao issue (REAL Haiku call).
  let classification: Awaited<ReturnType<typeof classifyWork>> | null = null;
  try {
    classification = await classifyWork({
      source: "github:issue_assigned",
      repo: TEST_REPO,
      number: 1,
      title: "Add hello endpoint returning JSON",
      body: "The testing-ao repo needs a GET /hello endpoint that returns {\"msg\":\"hello\"} plus a test.",
    });
    const valid =
      ["implementation", "review", "testing", "custom"].includes(classification.kind) &&
      classification.title.length > 0;
    record("classify", valid ? "PASS" : "FAIL", JSON.stringify(classification).slice(0, 300));
  } catch (e) {
    record("classify", "FAIL", (e as Error).message.slice(0, 300));
  }

  // 4. Build customized prompt (per-kind base prompt — no skills).
  try {
    const prompt = await buildSystemPrompt(sbAny, classification ?? { kind: "implementation", title: "t", repo: TEST_REPO, risk: "low", plan: "p" }, {
      eventContext: "issue body here",
    });
    const ok = prompt.includes(TEST_REPO) && prompt.includes("solar/");
    record("prompt-build", ok ? "PASS" : "FAIL", `${prompt.length} chars, repo+branch rules ${ok ? "present" : "MISSING"}`);
  } catch (e) {
    record("prompt-build", "FAIL", (e as Error).message.slice(0, 300));
  }

  // 6. TensorLake sandbox: create → clone testing-ao → ls → destroy (REAL).
  try {
    const sb = await createSandbox(`solar-e2e-${Date.now().toString(36)}`);
    record("sandbox-create", "PASS", `id=${sb.id} mock=${sb.mock}`);
    const clone = await sandboxExec(
      sb,
      `mkdir -p /tmp/solar-work && rm -rf /tmp/solar-work/testing-ao && git clone --depth 5 https://github.com/${TEST_REPO}.git /tmp/solar-work/testing-ao && ls -la /tmp/solar-work/testing-ao`,
      { timeoutMs: 120000 }
    );
    record("sandbox-clone", clone.exitCode === 0 ? "PASS" : "FAIL", `exit=${clone.exitCode} out=${clone.stdout.slice(0, 200)} err=${clone.stderr.slice(0, 200)}`);
    const exec = await sandboxExec(sb, `echo '{"msg":"hello"}' > /tmp/solar-work/testing-ao/hello.json && cat /tmp/solar-work/testing-ao/hello.json`);
    record("sandbox-exec", exec.exitCode === 0 && exec.stdout.includes("hello") ? "PASS" : "FAIL", `exit=${exec.exitCode} out=${exec.stdout.slice(0, 120)}`);
    await destroySandbox(sb);
    record("sandbox-destroy", "PASS", "destroy called");
  } catch (e) {
    record("sandbox", "FAIL", (e as Error).message.slice(0, 300));
  }

  // 7. Armoriq intent allowlist (per-kind tool policy).
  try {
    const impl = allowedToolsForKind("implementation");
    const review = allowedToolsForKind("review");
    const ok =
      impl.includes("create_pr") &&
      impl.includes("write_file") &&
      !review.includes("create_pr") &&
      !review.includes("write_file");
    record(
      "guardrails-allowlist",
      ok ? "PASS" : "FAIL",
      `implementation=${impl.length} tools, review=${review.length} tools, guardrails ${isGuardrailsConfigured() ? "configured" : "unconfigured (fail-open)"}`
    );
  } catch (e) {
    record("guardrails-allowlist", "FAIL", (e as Error).message.slice(0, 300));
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n==== E2E: ${pass} PASS / ${fail} FAIL ====`);
  writeFileSync(
    new URL("./e2e-results.json", import.meta.url),
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2)
  );
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
