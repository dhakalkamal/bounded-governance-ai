"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Flag,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { listDocuments, getFindings, getAuditLog } from "@/lib/api";
import { severityColor, agentLabel, agentColor } from "@/lib/utils";
import { useUser } from "@/context/user-context";

const SEVERITY_COLORS: Record<string, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#60a5fa",
  info: "#94a3b8",
};

const AGENT_COLORS: Record<string, string> = {
  minutes_analyzer: "#60a5fa",
  framework_checker: "#a78bfa",
  coi_detector: "#fbbf24",
  cross_document: "#2dd4bf",
};

const MONTHS = ["Jan", "Feb", "Mar"];

function monthFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.includes("jan")) return "Jan";
  if (lower.includes("feb")) return "Feb";
  if (lower.includes("mar")) return "Mar";
  return null;
}

export default function Dashboard() {
  const { currentUser } = useUser();
  const [allFindings, setAllFindings] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [docs, findingsRes, auditRes] = await Promise.all([
          listDocuments().catch(() => ({ documents: [], total: 0 })),
          getFindings().catch(() => ({ findings: [], total: 0 })),
          getAuditLog().catch(() => ({ entries: [], total: 0 })),
        ]);

        setDocCount(docs.total || 0);
        setAllFindings(findingsRes.findings || []);
        setRecentAudit((auditRes.entries || []).slice(0, 8));
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [currentUser.name]);

  // Derived chart data from real findings
  const stats = useMemo(() => {
    const high = allFindings.filter((f) => f.severity === "high").length;
    const medium = allFindings.filter((f) => f.severity === "medium").length;
    const low = allFindings.filter((f) => f.severity === "low").length;
    const info = allFindings.filter(
      (f) => f.severity === "info" || !["high", "medium", "low"].includes(f.severity)
    ).length;
    const flagged = allFindings.filter((f) => f.flagged_for_review).length;
    return { high, medium, low, info, total: allFindings.length, flagged };
  }, [allFindings]);

  const severityData = useMemo(
    () =>
      [
        { name: "High", value: stats.high, color: SEVERITY_COLORS.high },
        { name: "Medium", value: stats.medium, color: SEVERITY_COLORS.medium },
        { name: "Low", value: stats.low, color: SEVERITY_COLORS.low },
        { name: "Info", value: stats.info, color: SEVERITY_COLORS.info },
      ].filter((d) => d.value > 0),
    [stats]
  );

  const agentData = useMemo(() => {
    const agents: Record<string, { count: number; totalConf: number }> = {};
    for (const f of allFindings) {
      const key = f.agent_type || "unknown";
      if (!agents[key]) agents[key] = { count: 0, totalConf: 0 };
      agents[key].count++;
      agents[key].totalConf += f.confidence ?? 0;
    }
    return Object.entries(agents).map(([key, v]) => ({
      name: agentLabel(key),
      key,
      findings: v.count,
      accuracy: v.count > 0 ? Math.round((v.totalConf / v.count) * 100) : 0,
    }));
  }, [allFindings]);

  const trendData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of MONTHS) counts[m] = 0;
    for (const f of allFindings) {
      const month = monthFromFilename(f.source_document || "");
      if (month) counts[month]++;
    }
    return MONTHS.map((m) => ({ month: m, findings: counts[m] }));
  }, [allFindings]);

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
          value={docCount}
          color="text-blue-400"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Total Findings"
          value={stats.total}
          color="text-emerald-400"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="High Severity"
          value={stats.high}
          color="text-red-400"
        />
        <StatCard
          icon={<Flag className="w-5 h-5" />}
          label="Flagged for Review"
          value={stats.flagged}
          color="text-amber-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity pie */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <h2 className="text-base font-semibold mb-4">Severity Breakdown</h2>
          {severityData.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              No findings data yet.
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    stroke="none"
                  >
                    {severityData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {severityData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agent bar chart */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <h2 className="text-base font-semibold mb-4">AI Agent Performance</h2>
          {agentData.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              No findings data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={105}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    String(value),
                    name === "findings" ? "Findings" : "Avg Confidence %",
                  ]}
                />
                <Bar dataKey="findings" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={14} name="findings" />
                <Bar dataKey="accuracy" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={14} name="accuracy" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {agentData.length > 0 && (
            <div className="flex justify-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Findings
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Avg Confidence %
              </span>
            </div>
          )}
        </div>

        {/* Trend line chart */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
          <h2 className="text-base font-semibold mb-4">Findings Over Time</h2>
          {allFindings.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              No findings data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="findings" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4, fill: "#60a5fa" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
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
          {allFindings.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              No findings yet. Upload documents and run an analysis.
            </p>
          ) : (
            <div className="space-y-3">
              {allFindings.slice(0, 5).map((f: any) => (
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
        {currentUser.permissions.uploadDocuments && (
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
        )}
        {currentUser.permissions.runAnalysis && (
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
        )}
        {currentUser.permissions.chat && (
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
        )}
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
