"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  Search,
  MessageSquare,
  ScrollText,
  Shield,
  ChevronDown,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/user-context";
import { USERS, type Permission } from "@/lib/rbac";

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: keyof Permission;
}[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "viewDashboard" },
  { href: "/documents", label: "Documents", icon: FileUp, permission: "viewDocuments" },
  { href: "/analysis", label: "Analysis", icon: Search, permission: "viewFindings" },
  { href: "/chat", label: "Chat", icon: MessageSquare, permission: "chat" },
  { href: "/audit", label: "Audit Trail", icon: ScrollText, permission: "viewAudit" },
];

const ROLE_COLORS: Record<string, string> = {
  "Board Chair": "bg-purple-500/20 text-purple-400",
  "Governance Analyst": "bg-blue-500/20 text-blue-400",
  "Compliance Officer": "bg-emerald-500/20 text-emerald-400",
  "Ops Manager": "bg-amber-500/20 text-amber-400",
  Intern: "bg-gray-500/20 text-gray-400",
};

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, setCurrentUser } = useUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleNav = navItems.filter(
    (item) => !item.permission || currentUser.permissions[item.permission]
  );

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

      {/* User switcher */}
      <div className="p-3 border-b border-[var(--border)]" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-primary)] transition-colors"
        >
          <UserCircle className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate">{currentUser.name}</p>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                ROLE_COLORS[currentUser.role] || ""
              )}
            >
              {currentUser.role}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-[var(--text-muted)] transition-transform",
              dropdownOpen && "rotate-180"
            )}
          />
        </button>

        {dropdownOpen && (
          <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden shadow-lg">
            {USERS.map((user) => (
              <button
                key={user.name}
                onClick={() => {
                  setCurrentUser(user);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors",
                  user.name === currentUser.name && "bg-[var(--bg-hover)]"
                )}
              >
                <UserCircle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{user.name}</p>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      ROLE_COLORS[user.role] || ""
                    )}
                  >
                    {user.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {visibleNav.map((item) => {
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
    </aside>
  );
}
