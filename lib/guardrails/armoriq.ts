/**
 * ArmorIQ intent guardrails for Solar sub-agents.
 *
 * Every sub-agent run is bound to an explicit intent plan (the tools it is
 * ALLOWED to use for its kind). Before any tool executes, the call is checked
 * against that plan through the ArmorIQ SDK. A tool outside the plan is intent
 * drift: the run is stopped and the user is notified.
 *
 * Enforcement is local / in-process (ArmorIQ "local" session mode) — no MCP
 * onboarding or proxy routing required. Everything degrades gracefully: if the
 * API key or SDK is unavailable, a deterministic per-kind allowlist is still
 * enforced so drift is never silently accepted.
 */

import { randomUUID } from "node:crypto";
import { ArmorIQClient, type ArmorIQSession } from "@armoriq/sdk";
import { solarEnv } from "../env";
import type { SubAgentKind } from "@/types/solar-types";

/** Synthetic MCP name all Solar tools are attributed to in the intent plan. */
export const SOLAR_MCP = "solar-tools";

/** Tools every sub-agent may use (exploration, verification, completion). */
const BASE_TOOLS = [
  "read_file",
  "glob",
  "grep",
  "sandbox_exec",
  "track_tasks",
  "finish_task",
  "github_read",
  "ci_status",
  "self_diff",
  "web_search",
  "fetch_url",
];

/**
 * Per-kind scope. This is the intent plan: it declares what each sub-agent kind
 * is authorized to do. A review agent reaching for `write_file`/`create_pr`
 * (i.e. silently switching from reviewing to implementing) is out of scope and
 * is caught here.
 */
const KIND_TOOLS: Record<SubAgentKind, string[]> = {
  review: [...BASE_TOOLS, "github_comment", "submit_pr_review", "create_issue"],
  testing: [
    ...BASE_TOOLS,
    "write_file",
    "edit_file",
    "github_comment",
    "create_issue",
    "create_pr",
    "submit_pr_review",
  ],
  implementation: [...BASE_TOOLS, "write_file", "edit_file", "github_comment", "create_issue", "create_pr"],
  custom: [...BASE_TOOLS, "write_file", "edit_file", "github_comment", "create_issue", "create_pr", "submit_pr_review"],
};

export function allowedToolsForKind(kind: SubAgentKind): string[] {
  return KIND_TOOLS[kind] ?? KIND_TOOLS.custom;
}

let client: ArmorIQClient | null = null;

function getClient(): ArmorIQClient | null {
  if (!solarEnv.armoriqApiKey) return null;
  if (!client) {
    try {
      client = new ArmorIQClient({
        apiKey: solarEnv.armoriqApiKey,
        // PAP refine is best-effort in dev; never fail-closed on a cold gateway.
        papFailMode: "open",
      });
    } catch {
      client = null;
    }
  }
  return client;
}

export function isGuardrailsConfigured(): boolean {
  return Boolean(solarEnv.armoriqApiKey);
}

export interface IntentDecision {
  allowed: boolean;
  action: "allow" | "block" | "hold";
  reason: string;
  source: "armoriq" | "allowlist" | "unavailable";
}

export interface AgentGuard {
  session: ArmorIQSession | null;
  allowed: Set<string>;
  planId?: string;
  planHash?: string;
  /** False when ArmorIQ was unavailable and only the static allowlist is active. */
  armoriqActive: boolean;
}

export interface StartGuardInput {
  userEmail: string;
  kind: SubAgentKind;
  goal: string;
  systemPrompt: string;
  taskPrompt: string;
}

/**
 * Open an intent-verification session for one sub-agent run. Never throws —
 * on any failure it returns a guard with only the deterministic allowlist.
 */
export async function startAgentGuard(input: StartGuardInput): Promise<AgentGuard> {
  const allowed = new Set(allowedToolsForKind(input.kind));
  const base: AgentGuard = { session: null, allowed, armoriqActive: false };

  const c = getClient();
  if (!c) return base;

  try {
    const email = input.userEmail || solarEnv.armoriqUserEmail || "unknown@solar.local";
    const scope = c.forUser(email);
    const session = scope.startSession({
      mode: "local",
      llm: solarEnv.aiModel,
      defaultMcpName: SOLAR_MCP,
      validitySeconds: 3600,
      sessionId: randomUUID(),
    });
    // Declare the full authorized scope up front; the agent may use any of
    // these in any order. Anything else is out of plan by construction.
    const toolCalls = [...allowed].map((name) => ({ name, args: {} }));
    const token = await session.startPlan(toolCalls, input.goal);
    await recordEvent(session, `intent plan captured: ${input.goal}`);
    return {
      session,
      allowed,
      armoriqActive: true,
      planId: token?.planId,
      planHash: token?.planHash,
    };
  } catch (err) {
    console.warn("ArmorIQ startAgentGuard failed (falling back to allowlist):", (err as Error).message);
    return base;
  }
}

/**
 * Decide whether a tool call is within the agent's intent. ArmorIQ is consulted
 * first; if the SDK is unavailable or errors, the deterministic allowlist is
 * authoritative (fail-open for infra, fail-closed for scope).
 */
export async function checkToolCall(
  guard: AgentGuard,
  toolName: string,
  params: Record<string, unknown>
): Promise<IntentDecision> {
  if (guard.session) {
    try {
      const decision = await guard.session.check(toolName, params);
      if (decision.allowed) {
        return { allowed: true, action: "allow", reason: decision.reason || "in plan", source: "armoriq" };
      }
      return {
        allowed: false,
        action: decision.action === "hold" ? "hold" : "block",
        reason: decision.reason || "tool not in intent plan",
        source: "armoriq",
      };
    } catch (err) {
      console.warn("ArmorIQ check failed (falling back to allowlist):", (err as Error).message);
    }
  }

  const inScope = guard.allowed.has(toolName);
  return {
    allowed: inScope,
    action: inScope ? "allow" : "block",
    reason: inScope
      ? "in kind scope (allowlist)"
      : `"${toolName}" is outside this agent's scope — ${"declared intent"}`,
    source: guard.armoriqActive ? "armoriq" : "allowlist",
  };
}

/** Report a finished tool call back to ArmorIQ (observability + audit). */
export async function reportToolResult(
  guard: AgentGuard,
  toolName: string,
  params: Record<string, unknown>,
  output: string,
  ok: boolean,
  durationMs: number
): Promise<void> {
  if (!guard.session) return;
  try {
    await guard.session.report(toolName, params, output.slice(0, 2000), {
      status: ok ? "success" : "failed",
      errorMessage: ok ? undefined : output.slice(0, 300),
      durationMs,
    });
  } catch {
    // observability must never break a run
  }
}

/** Record model usage on the active plan trace (best-effort). */
export async function recordModelUsage(
  guard: AgentGuard,
  usage: { model: string; inputTokens?: number; outputTokens?: number; prompt?: string; completion?: string }
): Promise<void> {
  if (!guard.session) return;
  try {
    const recorder = guard.session.observabilityRecorder;
    const ctx = guard.session.activePlanTraceContext;
    if (!recorder || !ctx) return;
    const { recordGeneration } = await import("@armoriq/sdk");
    recordGeneration(recorder, ctx, {
      model: usage.model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      prompt: usage.prompt ?? null,
      completion: usage.completion ?? null,
      finishReason: "stop",
    });
  } catch {
    // best-effort
  }
}

/** Emit a point-in-time event onto the plan trace (best-effort). */
async function recordEvent(session: ArmorIQSession, message: string): Promise<void> {
  try {
    const recorder = session.observabilityRecorder;
    const ctx = session.activePlanTraceContext;
    if (!recorder || !ctx) return;
    const { recordEvent: rec } = await import("@armoriq/sdk");
    rec(recorder, ctx, { message, level: "info" });
  } catch {
    // best-effort
  }
}

/** Close the session's observability lifecycle. Never throws. */
export async function endAgentGuard(guard: AgentGuard, status: "ok" | "error" | "denied" = "ok"): Promise<void> {
  if (!guard.session) return;
  try {
    await guard.session.close(status);
  } catch {
    // teardown must never break a run
  }
}
