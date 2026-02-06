import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: string) {
  switch (severity) {
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
    default:
      return "text-slate-400 bg-slate-400/10";
  }
}
