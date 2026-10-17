"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { SubAgent } from "@/types/solar-types";
import { AgentCard } from "../agent-card";
import { CardSkeleton, FetchError } from "@/components/common/loading";

type StatusFilter = "all" | SubAgent["status"];

const UNDERSCORE_RE = /_/g;

const NO_AGENTS_EMPTY = (
  <section className="panel"><div className="panel-empty">
    No sub-agents yet. Ask the orchestrator for work or wait for the next GitHub poll.
  </div></section>
);

const NO_MATCH_EMPTY = (
  <section className="panel"><div className="panel-empty">No agents match this filter.</div></section>
);

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "awaiting_approval", label: "Needs approval" },
  { id: "running", label: "Running" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "blocked", label: "Blocked" },
];

export function AgentsView() {
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const deferredQuery = React.useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const aRes = await fetch("/api/agents");
      if (aRes.ok) {
        const data = (await aRes.json()) as { agents: SubAgent[] };
        setAgents(data.agents ?? []);
        setLoadError(null);
      } else {
        setLoadError("Some data couldn't load. Showing what's available.");
      }
    } catch {
      setLoadError("Couldn't load agents. Check your connection and retry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChanged = useCallback(() => void load().catch(() => {}), [load]);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    void load().catch(() => {});
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(() => {});
    const t = setInterval(() => void load().catch(() => {}), 15000);
    const onRefresh = () => void load().catch(() => {});
    window.addEventListener("solar:refresh", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("solar:refresh", onRefresh);
    };
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: agents.length,
      awaiting_approval: 0,
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
    };
    for (const a of agents) c[a.status] += 1;
    return c;
  }, [agents]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return agents.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (!q) return true;
      const repo = ((a.result as { repo?: string } | undefined)?.repo ?? "").toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.kind.toLowerCase().includes(q) ||
        a.status.replace(UNDERSCORE_RE, " ").includes(q) ||
        repo.includes(q)
      );
    });
  }, [agents, deferredQuery, filter]);

  const running = counts.running;

  return (
    <div>
      <div className="dash-title">
        <div>
          <h1>Agents</h1>
          <p>
            {running} running · {counts.awaiting_approval} waiting for approval ·{" "}
            {agents.length} total sub-agents spawned by the orchestrator.
          </p>
        </div>
      </div>

      <div className="filter-tabs" role="tablist" aria-label="Filter agents by status">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`chat-tab ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} <span className="item-meta">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="search-bar" role="search">
        <Search className="size-4" style={{ alignSelf: "center", color: "var(--muted-foreground)", flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, repo, kind, status…"
          aria-label="Search agents"
        />
      </div>

      {loadError && !isLoading ? (
        <FetchError message={loadError} onRetry={handleRetry} />
      ) : null}

      {isLoading ? (
        <div className="agent-list" aria-busy="true">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {!isLoading && !loadError && filtered.length === 0 ? (agents.length === 0 ? NO_AGENTS_EMPTY : NO_MATCH_EMPTY) : null}

      <div className="agent-list">
        {filtered.map((a) => (
          <AgentCard key={a.id} agent={a} onChanged={handleChanged} />
        ))}
      </div>
    </div>
  );
}
