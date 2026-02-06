"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Flag,
} from "lucide-react";
import { listDocuments, getFindings, getAuditLog } from "@/lib/api";
import { severityColor, agentLabel, agentColor } from "@/lib/utils";

export default function Dashboard() {
  const [stats, setStats] = useState({
    documents: 0,
    findings: 0,
    highSeverity: 0,
    flaggedForReview: 0,
  });
  const [recentFindings, setRecentFindings] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [docs, findingsRes, auditRes] = await Promise.all([
          listDocuments().catch(() => ({ documents: [], total: 0 })),
          getFindings().catch(() => ({ findings: [], total: 0 })),
          getAuditLog().catch(() => ({ entries: [], total: 0 })),
        ]);

        const findings = findingsRes.findings || [];
        setStats({
          documents: docs.total || 0,
          findings: findingsRes.total || 0,
          highSeverity: findings.filter(
            (f: any) => f.severity === "high"
          ).length,
          flaggedForReview: findings.filter(
            (f: any) => f.flagged_for_review
          ).length,
        });
        setRecentFindings(findings.slice(0, 5));
        setRecentAudit((auditRes.entries || []).slice(0, 8));
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-[var(--text-muted)]">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Governance Dashboard</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Overview of governance analysis and agent findings
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Documents"
          value={stats.documents}
          color="text-blue-400"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Total Findings"
          value={stats.findings}
          color="text-emerald-400"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="High Severity"
          value={stats.highSeverity}
          color="text-red-400"
        />
        <StatCard
          icon={<Flag className="w-5 h-5" />}
          label="Flagged for Review"
          value={stats.flaggedForReview}
          color="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent findings */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Recent Findings</h2>
            <Link
              href="/analysis"
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentFindings.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              No findings yet. Upload documents and run an analysis.
            </p>
          ) : (
            <div className="space-y-3">
              {recentFindings.map((f: any) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]"
                >
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${severityColor(f.severity)}`}
                  >
                    {f.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      <span className={`${agentColor(f.agent_type)} px-1.5 py-0.5 rounded text-xs`}>
                        {agentLabel(f.agent_type)}
                      </span>
                      {f.source_document && (
                        <span className="ml-2">{f.source_document}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {(f.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit trail */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Audit Trail</h2>
            <Link
              href="/audit"
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              No audit entries yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recentAudit.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-xs"
                >
                  <Clock className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                  <span className="text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`${agentColor(entry.agent_type || "")} px-1.5 py-0.5 rounded`}>
                    {entry.agent_type || "system"}
                  </span>
                  <span className="text-[var(--text-secondary)] truncate">
                    {entry.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/documents"
          className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 hover:border-[var(--accent)] transition-colors group"
        >
          <FileText className="w-8 h-8 text-blue-400 mb-3" />
          <h3 className="font-semibold mb-1">Upload Documents</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Upload board minutes, policies, and governance docs
          </p>
        </Link>
        <Link
          href="/analysis"
          className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 hover:border-[var(--accent)] transition-colors group"
        >
          <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
          <h3 className="font-semibold mb-1">Run Analysis</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Analyze documents with three specialized AI agents
          </p>
        </Link>
        <Link
          href="/chat"
          className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 hover:border-[var(--accent)] transition-colors group"
        >
          <Clock className="w-8 h-8 text-emerald-400 mb-3" />
          <h3 className="font-semibold mb-1">Governed Chat</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Ask questions grounded in your governance documents
          </p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center justify-between">
        <span className={color}>{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm text-[var(--text-muted)] mt-2">{label}</p>
    </div>
  );
}
