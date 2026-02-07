import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================================================
// CORE UTILITIES
// ============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case "high":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    case "medium":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "low":
      return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    default:
      return "text-slate-400 bg-slate-400/10 border-slate-400/30";
  }
}

export function agentLabel(agentType: string) {
  switch (agentType) {
    case "minutes_analyzer":
      return "Minutes Analyzer";
    case "framework_checker":
      return "Framework Checker";
    case "coi_detector":
      return "COI Detector";
    case "reviewer":
      return "Reviewer";
    case "cross_document":
      return "Cross-Document";
    default:
      return agentType;
  }
}

export function agentColor(agentType: string) {
  switch (agentType) {
    case "minutes_analyzer":
      return "text-blue-400 bg-blue-400/10";
    case "framework_checker":
      return "text-purple-400 bg-purple-400/10";
    case "coi_detector":
      return "text-amber-400 bg-amber-400/10";
    case "reviewer":
      return "text-emerald-400 bg-emerald-400/10";
    case "cross_document":
      return "text-teal-400 bg-teal-400/10";
    default:
      return "text-slate-400 bg-slate-400/10";
  }
}

// ============================================================================
// FORMATTING & HELPERS
// ============================================================================

export function formatRelativeTime(date: Date | string): string {
  if (!date) return "";
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return dateObj.toLocaleDateString();
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
