"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Flag,
  Download,
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
  Legend,
} from "recharts";
import { listDocuments, getFindings } from "@/lib/api";
import { agentLabel } from "@/lib/utils";
import { useUser } from "@/context/user-context";

const SEVERITY_COLORS: Record<string, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#60a5fa",
  info: "#94a3b8",
};

const MONTHS = ["Jan", "Feb", "Mar"];

function monthFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.includes("jan")) return "Jan";
  if (lower.includes("feb")) return "Feb";
  if (lower.includes("mar")) return "Mar";
  return null;
}

function escapeCsvField(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function Dashboard() {
  const { currentUser } = useUser();
  const [allFindings, setAllFindings] = useState<any[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [docs, findingsRes] = await Promise.all([
          listDocuments().catch(() => ({ documents: [], total: 0 })),
          getFindings().catch(() => ({ findings: [], total: 0 })),
        ]);

        setDocCount(docs.total || 0);
        setAllFindings(findingsRes.findings || []);
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [currentUser.name]);

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

  const exportCsv = useCallback(() => {
    const headers = [
      "title",
      "severity",
      "agent_type",
      "confidence",
      "source_document",
      "description",
      "evidence_quote",
      "review_status",
    ];
    const rows = allFindings.map((f) =>
      headers.map((h) => {
        let val = f[h];
        if (h === "confidence" && typeof val === "number") val = (val * 100).toFixed(1) + "%";
        return escapeCsvField(String(val ?? ""));
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allFindings]);

  const tooltipStyle = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "12px",
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Governance Dashboard</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Overview of governance analysis and agent findings
          </p>
        </div>
        {allFindings.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
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

      {/* Charts — 2-column layout for bigger charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity pie — larger */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
          <h2 className="text-base font-semibold mb-4">Severity Breakdown</h2>
          {severityData.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-12 text-center">
              No findings data yet.
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    stroke="none"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {severityData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-3">
                {severityData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agent bar chart — larger */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
          <h2 className="text-base font-semibold mb-4">AI Agent Performance</h2>
          {agentData.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-12 text-center">
              No findings data yet.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={agentData} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={115}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, name: unknown) => [
                      String(value),
                      name === "findings" ? "Findings" : "Avg Confidence %",
                    ]}
                  />
                  <Bar dataKey="findings" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={16} name="findings" />
                  <Bar dataKey="accuracy" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={16} name="accuracy" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-5 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <span className="w-3 h-3 rounded-full bg-blue-400" /> Findings
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <span className="w-3 h-3 rounded-full bg-purple-400" /> Avg Confidence %
                </span>
              </div>
            </>
          )}
        </div>

        {/* Trend line chart — full width */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
          <h2 className="text-base font-semibold mb-4">Findings Over Time</h2>
          {allFindings.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-12 text-center">
              No findings data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ left: -10, right: 20, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="findings" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 5, fill: "#60a5fa" }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
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
