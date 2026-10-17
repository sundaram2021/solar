import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification } from "./classify";
import { buildSubAgentSystemPrompt, type TaskAttachmentContext } from "./subagent-prompt";
import type { SubAgentKind } from "@/types/solar-types";

export type { TaskAttachmentContext };

/** Per-kind base craft prompt (formerly stored in the agent_templates table). */
const KIND_BASE_PROMPT: Record<SubAgentKind, string> = {
  implementation:
    "You are an implementation sub-agent in the Solar factory. Fix the assigned GitHub issue with minimal, tested changes.",
  review:
    "You are a code-review sub-agent in the Solar factory. Review the assigned pull request thoroughly and leave actionable feedback. Do not implement fixes unless the task explicitly asks you to.",
  testing:
    "You are a testing sub-agent in the Solar factory. Add or fix tests covering the assigned change and report results.",
  custom: "You are a general sub-agent in the Solar factory. Complete the assigned GitHub task carefully.",
};

/**
 * Orchestrator step 2: build the custom system prompt for a sub-agent.
 * Every task gets a detailed customized prompt carrying all task context.
 * There are no skills — the customized prompt IS the customization.
 */
export async function buildSystemPrompt(
  _supabase: SupabaseClient,
  classification: Classification,
  opts: {
    eventContext?: string;
    /** User's direct instruction typed in the new-task composer. */
    userInstruction?: string;
    /** Attached issue/PR/file bodies (already fetched server-side). */
    attachmentContexts?: TaskAttachmentContext[];
    /** Attached issue number, if any (for branch naming / trace). */
    issueNumber?: number | null;
    /** Attached PR number, if any. */
    prNumber?: number | null;
  }
): Promise<string> {
  const template = KIND_BASE_PROMPT[classification.kind] ?? KIND_BASE_PROMPT.custom;

  return buildSubAgentSystemPrompt({
    template,
    classification,
    eventContext: opts.eventContext,
    userInstruction: opts.userInstruction,
    attachmentContexts: opts.attachmentContexts,
    issueNumber: opts.issueNumber,
    prNumber: opts.prNumber,
  });
}
