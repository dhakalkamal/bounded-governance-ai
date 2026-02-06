"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  Search,
  MessageSquare,
  ScrollText,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileUp },
  { href: "/analysis", label: "Analysis", icon: Search },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/audit", label: "Audit Trail", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-[var(--accent)]" />
          <div>
            <h1 className="text-sm font-bold tracking-tight">Governance</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Bounded Agentic AI
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          Gemini 2.5 Pro Agents
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          All actions audited
        </p>
      </div>
    </aside>
  );
}
