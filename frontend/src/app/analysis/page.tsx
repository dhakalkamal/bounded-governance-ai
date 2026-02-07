"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  AlertTriangle,
  Flag,
  Quote,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { getFindings, updateFindingStatus } from "@/lib/api";
import { severityColor, agentLabel, agentColor, cn } from "@/lib/utils";

export default function AnalysisPage() {
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const params: any = {};
        if (filterAgent) params.agent_type = filterAgent;
        if (filterSeverity) params.severity = filterSeverity;
        const res = await getFindings(params);
        setFindings(res.findings || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filterAgent, filterSeverity]);

  // Group findings by agent
  const byAgent: Record<string, any[]> = {};
  for (const f of findings) {
    const key = f.agent_type || "unknown";
    if (!byAgent[key]) byAgent[key] = [];
    byAgent[key].push(f);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analysis Findings</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Agent findings organized by type with evidence citations
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterAgent}
          onChange={(e) => {
            setFilterAgent(e.target.value);
            setLoading(true);
          }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="">All Agents</option>
          <option value="minutes_analyzer">Minutes Analyzer</option>
          <option value="framework_checker">Framework Checker</option>
          <option value="coi_detector">COI Detector</option>
          <option value="cross_document">Cross-Document</option>
          <option value="reviewer">Reviewer</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => {
            setFilterSeverity(e.target.value);
            setLoading(true);
          }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <div className="ml-auto text-sm text-[var(--text-muted)] self-center">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          Loading findings...
        </div>
      ) : findings.length === 0 ? (
        <div className="text-center py-12 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
          <Search className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-[var(--text-muted)]">
            No findings yet. Upload documents and run an analysis from the
            Documents page.
          </p>
        </div>
      ) : (
        Object.entries(byAgent).map(([agent, agentFindings]) => (
          <div
            key={agent}
            className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)]"
          >
            <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${agentColor(agent)}`}
              >
                {agentLabel(agent)}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {agentFindings.length} finding
                {agentFindings.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {agentFindings.map((f: any) => {
                const expanded = expandedId === f.id;
                return (
                  <div key={f.id} className="p-4">
                    <button
                      onClick={() =>
                        setExpandedId(expanded ? null : f.id)
                      }
                      className="w-full flex items-start gap-3 text-left"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 mt-0.5 text-[var(--text-muted)] shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mt-0.5 text-[var(--text-muted)] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${severityColor(f.severity)}`}
                          >
                            {f.severity}
                          </span>
                          <span className="text-sm font-medium">
                            {f.title}
                          </span>
                          {f.review_status === "verified" ? (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : f.review_status === "disputed" ? (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Disputed
                            </span>
                          ) : f.review_status === "flagged" ? (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <Flag className="w-3 h-3" /> Flagged
                            </span>
                          ) : f.flagged_for_review ? (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <Flag className="w-3 h-3" /> Under review
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {f.finding_type} &middot; Confidence:{" "}
                          {(f.confidence * 100).toFixed(0)}%
                          {f.source_document &&
                            ` · ${f.source_document}`}
                        </p>
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-3 ml-7 space-y-3">
                        <p className="text-sm text-[var(--text-secondary)]">
                          {f.description}
                        </p>

                        {f.evidence_quote && (
                          <div className="flex gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] border-l-2 border-[var(--accent)]">
                            <Quote className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                            <p className="text-sm italic text-[var(--text-secondary)]">
                              &ldquo;{f.evidence_quote}&rdquo;
                            </p>
                          </div>
                        )}

                        <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                          {f.source_document && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {f.source_document}
                            </span>
                          )}
                          {f.section_reference && (
                            <span>Section: {f.section_reference}</span>
                          )}
                        </div>

                        {/* Verification buttons */}
                        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                          <button
                            onClick={async () => {
                              try {
                                const updated = await updateFindingStatus(f.id, "verified");
                                setFindings((prev) =>
                                  prev.map((ff) =>
                                    ff.id === f.id
                                      ? { ...ff, review_status: updated.review_status, flagged_for_review: updated.flagged_for_review }
                                      : ff
                                  )
                                );
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              f.review_status === "verified"
                                ? "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30"
                                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-400/10"
                            )}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Verify
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const updated = await updateFindingStatus(f.id, "disputed");
                                setFindings((prev) =>
                                  prev.map((ff) =>
                                    ff.id === f.id
                                      ? { ...ff, review_status: updated.review_status, flagged_for_review: updated.flagged_for_review }
                                      : ff
                                  )
                                );
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              f.review_status === "disputed"
                                ? "bg-red-400/20 text-red-400 border border-red-400/30"
                                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10"
                            )}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Dispute
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const updated = await updateFindingStatus(f.id, "flagged");
                                setFindings((prev) =>
                                  prev.map((ff) =>
                                    ff.id === f.id
                                      ? { ...ff, review_status: updated.review_status, flagged_for_review: updated.flagged_for_review }
                                      : ff
                                  )
                                );
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              f.review_status === "flagged"
                                ? "bg-amber-400/20 text-amber-400 border border-amber-400/30"
                                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-400/10"
                            )}
                          >
                            <Flag className="w-3.5 h-3.5" />
                            Flag for Review
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
