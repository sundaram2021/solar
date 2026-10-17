"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  Loader2,
  AlertCircle,
  CircleDot,
  CircleX,
  GitPullRequest,
  Cpu,
  MessageSquare,
  Sparkles,
  Search,
  Globe,
  ListChecks,
  Brain,
  Activity,
  FileSearch,
  FolderGit2,
  Radar,
} from "lucide-react";
import { ChatStep } from "@/types/solar-types";

interface ChatStepsProps {
  steps: ChatStep[];
  isLive?: boolean;
  /** Current thinking / executing label streamed from the server. */
  activeStep?: string | null;
  /** Newest assistant message keeps the timeline open; older ones start collapsed. */
  defaultOpen?: boolean;
}

const UNDERSCORE_RE = /_/g;

const TOOL_META_CACHE = new Map<string, { icon: React.ReactNode; name: string }>();

function toolMeta(tool: string): { icon: React.ReactNode; name: string } {
  const t = tool.toLowerCase();
  if (t.includes("spawn")) return { icon: <Cpu className="size-3.5" />, name: "Sub-agent" };
  if (t === "close_issue") return { icon: <CircleX className="size-3.5" />, name: "Close issue" };
  if (t === "close_pr") return { icon: <GitPullRequest className="size-3.5" />, name: "Close PR" };
  if (t.includes("issue") && t.includes("list")) return { icon: <ListChecks className="size-3.5" />, name: "Issues" };
  if (t.includes("pr") && (t.includes("list") || t === "list_prs")) return { icon: <ListChecks className="size-3.5" />, name: "PRs" };
  if (t.includes("issue")) return { icon: <CircleDot className="size-3.5" />, name: "Issue" };
  if (t.includes("pr") || t.includes("review")) return { icon: <GitPullRequest className="size-3.5" />, name: "PR" };
  if (t.includes("comment")) return { icon: <MessageSquare className="size-3.5" />, name: "Comment" };
  if (t.includes("code_search")) return { icon: <FileSearch className="size-3.5" />, name: "Code search" };
  if (t.includes("repo_overview") || t.includes("repo")) return { icon: <FolderGit2 className="size-3.5" />, name: "Repo" };
  if (t.includes("web") || t.includes("fetch") || t.includes("url")) return { icon: <Globe className="size-3.5" />, name: "Web" };
  if (t.includes("memory")) return { icon: <Brain className="size-3.5" />, name: "Memory" };
  if (t.includes("running") || t.includes("agent")) return { icon: <Radar className="size-3.5" />, name: "Agents" };
  if (t.includes("search")) return { icon: <Search className="size-3.5" />, name: "Search" };
  return { icon: <Wrench className="size-3.5" />, name: tool.replace(UNDERSCORE_RE, " ") };
}

function cachedToolMeta(tool: string): { icon: React.ReactNode; name: string } {
  const hit = TOOL_META_CACHE.get(tool);
  if (hit) return hit;
  const meta = toolMeta(tool);
  if (TOOL_META_CACHE.size > 200) TOOL_META_CACHE.clear();
  TOOL_META_CACHE.set(tool, meta);
  return meta;
}

export function ChatSteps({ steps, isLive = false, activeStep = null, defaultOpen }: ChatStepsProps) {
  const { runningCount, doneCount, errorCount } = useMemo(() => {
    let running = 0;
    let done = 0;
    let error = 0;
    for (const s of steps) {
      if (s.status === "running") running++;
      else if (s.status === "done") done++;
      else if (s.status === "error") error++;
    }
    return { runningCount: running, doneCount: done, errorCount: error };
  }, [steps]);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  // While streaming the timeline stays open so the user sees live activity;
  // otherwise the newest message starts open and older ones start collapsed.
  const isOpen = isLive ? true : (expanded ?? defaultOpen ?? steps.length <= 4);

  if ((!steps || steps.length === 0) && !activeStep) return null;

  return (
    <div className={`solar-timeline ${isLive ? "solar-timeline-live" : ""}`} aria-label="Agent activity">
      <button
        type="button"
        onClick={() => setExpanded(!isOpen)}
        className="solar-timeline-head"
        aria-expanded={isOpen}
      >
        <span className="solar-timeline-head-left">
          {runningCount > 0 || (isLive && activeStep) ? (
            <span className="solar-live-badge">
              <span className="solar-live-dot" />
              Working
            </span>
          ) : (
            <span className="solar-done-badge">
              <Sparkles className="size-3" />
              Behind the scenes
            </span>
          )}
          <span className="solar-timeline-summary">
            {runningCount > 0
              ? `${runningCount} running · ${doneCount} done`
              : errorCount > 0
                ? `${steps.length} steps · ${errorCount} failed`
                : `${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
          </span>
        </span>
        <span className="solar-timeline-chevron">
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
      </button>

      {isOpen && (
        <ol className="solar-timeline-list">
          {steps.map((step, idx) => {
            const meta = cachedToolMeta(step.tool);
            const isLast = idx === steps.length - 1 && !activeStep;
            return (
              <li
                key={`${step.tool}-${idx}`}
                className={`solar-timeline-item solar-timeline-${step.status} ${isLast ? "is-last" : ""}`}
              >
                <span className="solar-rail" aria-hidden="true">
                  <span className="solar-rail-dot">
                    {step.status === "running" ? (
                      <span className="inline-flex animate-spin"><Loader2 className="size-3" /></span>
                    ) : step.status === "error" ? (
                      <AlertCircle className="size-3" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                  </span>
                </span>
                <div className="solar-timeline-body">
                  <div className="solar-timeline-row">
                    <span className="solar-tool-chip">
                      {meta.icon}
                      {meta.name}
                    </span>
                    <code className="solar-tool-code">{step.tool}</code>
                    <span className={`solar-status-pill status-${step.status}`}>
                      {step.status === "running" ? "running" : step.status === "done" ? "done" : "error"}
                    </span>
                  </div>
                  <p className="solar-timeline-label">{step.label}</p>
                </div>
              </li>
            );
          })}
          {isLive && activeStep && (
            <li className="solar-timeline-item solar-timeline-running">
              <span className="solar-rail" aria-hidden="true">
                <span className="solar-rail-dot">
                  <span className="inline-flex animate-spin"><Loader2 className="size-3" /></span>
                </span>
              </span>
              <div className="solar-timeline-body">
                <div className="solar-timeline-row">
                  <span className="solar-tool-chip">
                    <Activity className="size-3.5" />
                    Thinking
                  </span>
                  <span className="solar-status-pill status-running">live</span>
                </div>
                <p className="solar-timeline-label solar-thinking-text">{activeStep}</p>
              </div>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

export function ChatLiveIndicator({ activeStep }: { activeStep: string }) {
  if (!activeStep) return null;
  return (
    <div className="solar-thinking" role="status" aria-live="polite">
      <span className="solar-thinking-spinner">
        <span className="inline-flex animate-spin"><Loader2 className="size-4" /></span>
      </span>
      <div className="solar-thinking-body">
        <span className="solar-thinking-tag">
          <span className="solar-live-dot" />
          Orchestrator working
        </span>
        <span className="solar-thinking-text">{activeStep}</span>
      </div>
    </div>
  );
}
