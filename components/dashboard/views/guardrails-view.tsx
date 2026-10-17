"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ShieldCheck, ShieldAlert, Search } from "lucide-react";
import { SubAgent, IntentViolation } from "@/types/solar-types";
import { RowSkeleton, FetchError } from "@/components/common/loading";

const GUARDRAILS_EMPTY = (
  <section className="panel">
    <div className="panel-empty">
      No intent violations. Every sub-agent has stayed within its approved scope.
    </div>
  </section>
);

export function GuardrailsView() {
  const [violations, setViolations] = useState<IntentViolation[]>([]);
  const [agents, setAgents] = useState<Record<string, SubAgent>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = React.useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [vRes, aRes] = await Promise.all([
        fetch("/api/agents?which=violations"),
        fetch("/api/agents"),
      ]);
      if (!vRes.ok) throw new Error(`load failed (${vRes.status})`);
      const vData = (await vRes.json()) as { violations: IntentViolation[] };
      setViolations(vData.violations ?? []);
      if (aRes.ok) {
        const aData = (await aRes.json()) as { agents: SubAgent[] };
        const map: Record<string, SubAgent> = {};
        for (const a of aData.agents ?? []) map[a.id] = a;
        setAgents(map);
      }
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load guardrail data. Check your connection and retry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const blockedCount = useMemo(
    () => Object.values(agents).filter((a) => a.status === "blocked").length,
    [agents]
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return violations;
    return violations.filter((v) => {
      const title = agents[v.sub_agent_id]?.title ?? "";
      return (
        v.tool.toLowerCase().includes(q) ||
        v.reason.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      );
    });
  }, [violations, agents, deferredQuery]);

  return (
    <div>
      <div className="dash-title">
        <div>
          <h1>Guardrails</h1>
          <p>
            Armoriq intent verification — every tool call is checked against the
            agent&apos;s approved scope. Out-of-plan actions are stopped and logged here.
          </p>
        </div>
      </div>

      <section className="panel status-strip" aria-label="Guardrail summary">
        <div className="status-item">
          <ShieldCheck className="size-4" />
          <div>
            <p>{Object.keys(agents).length} agents verified</p>
            <small>intent plans enforced</small>
          </div>
        </div>
        <div className="status-item">
          <ShieldAlert className="size-4" />
          <div>
            <p>{violations.length} violation{violations.length === 1 ? "" : "s"}</p>
            <small>{blockedCount} run{blockedCount === 1 ? "" : "s"} blocked</small>
          </div>
        </div>
      </section>

      <div className="search-bar" role="search">
        <Search className="size-4" style={{ alignSelf: "center", color: "var(--muted-foreground)", flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${violations.length} violations…`}
          aria-label="Search intent violations"
        />
      </div>

      {loadError && !isLoading ? (
        <FetchError message={loadError} onRetry={handleRetry} />
      ) : null}

      {isLoading ? (
        <section className="panel" aria-busy="true">
          <div className="activity-list activity-full">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </section>
      ) : null}

      {!isLoading && !loadError && filtered.length === 0 ? (
        violations.length === 0 ? GUARDRAILS_EMPTY : (
          <section className="panel"><div className="panel-empty">
            {`No violations match "${deferredQuery.trim()}".`}
          </div></section>
        )
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <section className="panel">
          <div className="activity-list activity-full">
            {filtered.map((v) => (
              <div key={v.id} className="activity" style={{ contentVisibility: "auto", containIntrinsicSize: "0 64px" }}>
                <ShieldAlert className="size-3.5" />
                <div>
                  <p>{agents[v.sub_agent_id]?.title ?? "Unknown agent"}</p>
                  <small>
                    <span className="mono">{v.tool}</span> · {v.reason}
                    {v.created_at ? (
                      <> · <span className="mono">{new Date(v.created_at).toLocaleString()}</span></>
                    ) : null}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
