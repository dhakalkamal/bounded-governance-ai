"use client";

import { useEffect, useState } from "react";
import { ScrollText, Clock, Filter } from "lucide-react"
import { getAuditLog } from "@/lib/api";
import { agentLabel, agentColor } from "@/lib/utils";

export default function AuditPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params: any = {};
        if (filterAgent) params.agent_type = filterAgent;
        const res = await getAuditLog(params);
        setEntries(res.entries || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filterAgent]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Complete log of every agent action with timestamps and input hashes
        </p>
      </div>

      <div className="flex gap-3">
        <select
          value={filterAgent}
          onChange={(e) => {
            setFilterAgent(e.target.value);
            setLoading(true);
          }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="">All Agents</option>
          <option value="orchestrator">Orchestrator</option>
          <option value="minutes_analyzer">Minutes Analyzer</option>
          <option value="framework_checker">Framework Checker</option>
          <option value="coi_detector">COI Detector</option>
          <option value="reviewer">Reviewer</option>
        </select>
        <span className="text-sm text-[var(--text-muted)] self-center ml-auto">
          {entries.length} entries
        </span>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            Loading audit log...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <ScrollText className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-[var(--text-muted)]">No audit entries yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2 shrink-0 w-40">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded shrink-0 ${agentColor(entry.agent_type || "")}`}
                >
                  {entry.agent_type
                    ? agentLabel(entry.agent_type)
                    : "system"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.action}</p>
                  {entry.output_summary && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                      {entry.output_summary}
                    </p>
                  )}
                </div>
                {entry.input_hash && (
                  <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">
                    #{entry.input_hash}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
