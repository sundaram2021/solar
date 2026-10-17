export interface SolarUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  githubUsername?: string;
}

export type TaskStatus = "running" | "review" | "completed" | "queued";

export interface SolarTask {
  id: string;
  title: string;
  description?: string;
  repo_name: string;
  issue_number?: number;
  pr_number?: number;
  assigned_agent: string;
  status: TaskStatus;
  created_at?: string;
  updated_at?: string;
}

export interface SolarActivity {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  type: "pr" | "sparkles" | "brain" | "issue" | "event" | "security";
  created_at?: string;
}

export interface SolarRepo {
  id: string;
  name: string;
  full_name: string;
  branch: string;
  is_active: boolean;
}

export interface SolarStats {
  activeAgents: number;
  tasksCompleted: number;
  prsMerged: number;
}

export type SubAgentStatus =
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type SubAgentKind =
  | "implementation"
  | "review"
  | "testing"
  | "custom";

export interface AgentResult {
  pr_number?: number;
  pr_url?: string;
  branch?: string;
  repo?: string;
  issue_number?: number;
  issue_url?: string;
  merged?: boolean;
}

export interface SubAgent {
  id: string;
  user_id: string;
  event_id?: string | null;
  kind: SubAgentKind;
  title: string;
  system_prompt: string;
  run_log?: string;
  result?: AgentResult;
  status: SubAgentStatus;
  sandbox_id?: string | null;
  trace_id?: string | null;
  blocked_reason?: string | null;
  created_at?: string;
}

export type GithubEventStatus =
  | "received"
  | "proposed"
  | "running"
  | "done"
  | "ignored";

export interface GithubEvent {
  id: string;
  user_id: string;
  delivery_id: string;
  type: string;
  repo: string;
  number?: number | null;
  title?: string | null;
  payload: Record<string, unknown>;
  status: GithubEventStatus;
  created_at?: string;
}

export type ApprovalKind =
  | "run_agent"
  | "publish_pr"
  | "merge"
  | "github_comment"
  | "close_issue"
  | "close_pr";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "executing" | "failed";

export interface Approval {
  id: string;
  user_id: string;
  kind: ApprovalKind;
  ref_id: string;
  status: ApprovalStatus;
  created_at?: string;
  decided_at?: string | null;
}

export interface ChatStep {
  tool: string;
  label: string;
  status: "running" | "done" | "error";
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  steps?: ChatStep[];
}

export type ChatKind = "orchestrator";

export interface IntentPlan {
  id: string;
  sub_agent_id: string;
  goal: string;
  allowed_tools: string[];
  status: "active" | "closed" | "violated";
  created_at?: string;
}

export interface IntentViolation {
  id: string;
  sub_agent_id: string;
  tool: string;
  reason: string;
  args_preview?: string | null;
  created_at?: string;
}

export interface UserSettings {
  user_id: string;
  orchestrator_auto_approve: boolean;
}
