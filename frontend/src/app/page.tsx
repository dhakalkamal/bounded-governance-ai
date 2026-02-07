"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Flag,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Download,
  RefreshCw,
  Calendar,
  Users,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { listDocuments, getFindings, getAuditLog } from "@/lib/api";
import { severityColor, agentLabel, agentColor } from "@/lib/utils";

// shadcn/ui components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdvancedDashboard() {
  const [stats, setStats] = useState({
    documents: 0,
    findings: 0,
    highSeverity: 0,
    flaggedForReview: 0,
  });
  const [recentFindings, setRecentFindings] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mock data for charts (replace with real data)
  const trendData = [
    { month: "Jan", findings: 12, resolved: 8 },
    { month: "Feb", findings: 19, resolved: 15 },
    { month: "Mar", findings: 15, resolved: 12 },
    { month: "Apr", findings: 25, resolved: 18 },
    { month: "May", findings: 22, resolved: 20 },
    { month: "Jun", findings: 30, resolved: 22 },
  ];

  const severityDistribution = [
    { name: "High", value: 8, color: "#ef4444" },
    { name: "Medium", value: 15, color: "#f59e0b" },
    { name: "Low", value: 12, color: "#3b82f6" },
  ];

  const agentPerformance = [
    { agent: "Compliance", findings: 45, accuracy: 94 },
    { agent: "Ethics", findings: 38, accuracy: 91 },
    { agent: "Risk", findings: 52, accuracy: 96 },
  ];

  const loadData = async () => {
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
        highSeverity: findings.filter((f: any) => f.severity === "high").length,
        flaggedForReview: findings.filter((f: any) => f.flagged_for_review).length,
      });
      setRecentFindings(findings.slice(0, 5));
      setRecentAudit((auditRes.entries || []).slice(0, 8));
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full mx-auto"
          />
          <p className="text-[var(--text-muted)] text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)] bg-clip-text">
            Governance Dashboard
          </h1>
          <p className="text-[var(--text-secondary)] flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid with Animation */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div variants={item}>
          <MetricCard
            icon={<FileText className="w-5 h-5" />}
            label="Total Documents"
            value={stats.documents}
            change={12}
            trend="up"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Total Findings"
            value={stats.findings}
            change={8}
            trend="up"
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="High Severity"
            value={stats.highSeverity}
            change={3}
            trend="down"
            iconBg="bg-red-500/10"
            iconColor="text-red-500"
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            icon={<Flag className="w-5 h-5" />}
            label="Flagged Items"
            value={stats.flaggedForReview}
            change={0}
            trend="neutral"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
          />
        </motion.div>
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Findings Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Findings Over Time</CardTitle>
            <CardDescription>Monthly trend of findings and resolutions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="month"
                  stroke="var(--text-muted)"
                  fontSize={12}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="findings"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: "#f59e0b", r: 4 }}
                  name="New Findings"
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", r: 4 }}
                  name="Resolved"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Severity Breakdown</CardTitle>
            <CardDescription>Distribution by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance */}
      <Card>
        <CardHeader>
          <CardTitle>AI Agent Performance</CardTitle>
          <CardDescription>Findings generated and accuracy metrics by agent</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={agentPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="agent" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="findings" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Findings" />
              <Bar dataKey="accuracy" fill="#10b981" radius={[8, 8, 0, 0]} name="Accuracy %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="findings" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="findings">Recent Findings</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="findings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Recent Findings</CardTitle>
                <CardDescription>Latest governance issues identified</CardDescription>
              </div>
              <Link href="/analysis">
                <Button variant="ghost" size="sm" className="gap-2">
                  View all <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentFindings.length === 0 ? (
                <EmptyState
                  icon={<Shield className="w-12 h-12" />}
                  message="No findings yet"
                  action={
                    <Link href="/documents">
                      <Button variant="outline" size="sm" className="mt-4">
                        Upload Documents
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {recentFindings.map((f: any) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Recent system events and actions</CardDescription>
              </div>
              <Link href="/audit">
                <Button variant="ghost" size="sm" className="gap-2">
                  View all <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentAudit.length === 0 ? (
                <EmptyState
                  icon={<Activity className="w-8 h-8" />}
                  message="No activity yet"
                />
              ) : (
                <div className="space-y-2">
                  {recentAudit.map((entry: any) => (
                    <ActivityItem key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}

// Sub-components
function MetricCard({
  icon,
  label,
  value,
  change,
  trend,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  change: number;
  trend: "up" | "down" | "neutral";
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`${iconBg} p-3 rounded-xl ${iconColor} group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tracking-tight">{value}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-muted)] font-medium">{label}</p>
          {trend !== "neutral" && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-emerald-500" : "text-red-500"
                }`}
            >
              {trend === "up" ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {change}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FindingCard({ finding }: { finding: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="group relative flex items-start gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 transition-all border border-transparent hover:border-[var(--border)] cursor-pointer"
    >
      <div
        className={`shrink-0 mt-0.5 w-1.5 h-12 rounded-full ${finding.severity === "high"
          ? "bg-red-500"
          : finding.severity === "medium"
            ? "bg-amber-500"
            : "bg-blue-500"
          }`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${severityColor(finding.severity)} font-medium`}>
              {finding.severity.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className={`${agentColor(finding.agent_type)}`}>
              {agentLabel(finding.agent_type)}
            </Badge>
          </div>
          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
            {(finding.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>

        <h4 className="font-medium text-sm mb-1 group-hover:text-[var(--accent)] transition-colors">
          {finding.title}
        </h4>

        {finding.source_document && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            {finding.source_document}
          </p>
        )}
      </div>

      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-3" />
    </motion.div>
  );
}

function ActivityItem({ entry }: { entry: any }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[var(--bg-secondary)] transition-colors text-xs group">
      <div className="shrink-0 w-2 h-2 rounded-full bg-[var(--accent)] opacity-60 group-hover:opacity-100" />
      <span className="text-[var(--text-muted)] whitespace-nowrap font-mono text-[10px]">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        {entry.agent_type || "system"}
      </Badge>
      <span className="text-[var(--text-secondary)] truncate">{entry.action}</span>
    </div>
  );
}

function EmptyState({
  icon,
  message,
  action,
}: {
  icon: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <div className="text-[var(--text-muted)] mx-auto mb-3">{icon}</div>
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
      {action}
    </div>
  );
}

function QuickActions() {
  const actions = [
    {
      href: "/documents",
      icon: <FileText className="w-6 h-6" />,
      title: "Upload Documents",
      description: "Add board minutes, policies, and governance documentation",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      href: "/analysis",
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Run Analysis",
      description: "Analyze documents with specialized AI compliance agents",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
    {
      href: "/chat",
      icon: <Shield className="w-6 h-6" />,
      title: "Governed Chat",
      description: "Ask questions grounded in your governance framework",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action, idx) => (
          <motion.div
            key={action.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link href={action.href}>
              <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-2 hover:border-[var(--accent)]">
                <CardContent className="p-6">
                  <div
                    className={`${action.iconBg} ${action.iconColor} p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform`}
                  >
                    {action.icon}
                  </div>
                  <h3 className="font-semibold text-base mb-2 group-hover:text-[var(--accent)] transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    {action.description}
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
