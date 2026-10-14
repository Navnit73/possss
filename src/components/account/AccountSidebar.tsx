"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  User, 
  Users, 
  ShieldCheck, 
  CreditCard,
  Receipt,
  Lock,
  ActivitySquare,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import clsx from "clsx";

const navGroups = [
  {
    title: "Account",
    items: [
      { name: "Profile", href: "/account/profile", icon: User },
      { name: "Users & Staff", href: "/account/users", icon: Users },
      { name: "Permissions", href: "/account/permissions", icon: ShieldCheck },
    ]
  },
  {
    title: "Billing",
    items: [
      { name: "Subscription", href: "/account/subscription", icon: CreditCard },
      { name: "Billing History", href: "/account/billing", icon: Receipt },
    ]
  },
  {
    title: "System",
    items: [
      { name: "Security", href: "/account/security", icon: Lock },
      { name: "Activity Logs", href: "/account/activity", icon: ActivitySquare },
    ]
  }
];

import { hasPermissionSync } from "@/lib/rbac";
import { Session } from "next-auth";

export function AccountSidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter groups and items based on permissions
  const filteredGroups = navGroups.map(group => {
    const items = group.items.filter(item => {
      // Profile is always visible to everyone
      if (item.name === "Profile" || item.name === "Security") return true;
      if (item.name === "Users & Staff") return hasPermissionSync(session, "USERS", "VIEW");
      if (item.name === "Permissions") return hasPermissionSync(session, "ROLES", "VIEW");
      // Billing and Subscription require SETTINGS view permission (or OWNER role which is handled by hasPermissionSync)
      if (item.name === "Subscription" || item.name === "Billing History") {
        return hasPermissionSync(session, "SETTINGS", "VIEW");
      }
      // Same rule as /api/account/activity: SETTINGS:VIEW or AUDIT_LOGS:VIEW
      if (item.name === "Activity Logs") {
        return hasPermissionSync(session, "SETTINGS", "VIEW") || hasPermissionSync(session, "AUDIT_LOGS", "VIEW");
      }
      return false;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  return (
    <nav
      aria-label="Account settings"
      className={clsx(
        "bg-canvas text-ink border-r border-hairline h-[calc(100dvh-2.75rem)] sticky top-11 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out print:hidden",
        // Phones always get the icon rail so the page content keeps the width
        isCollapsed ? "w-16" : "w-16 md:w-60"
      )}
    >
      <div className={clsx(
        "h-13 shrink-0 flex items-center border-b border-hairline",
        isCollapsed ? "justify-center px-0" : "justify-center px-0 md:justify-start md:px-6"
      )}>
        <Link href="/dashboard" aria-label="Back to Dashboard" className="text-link flex items-center gap-0.5 text-caption">
          <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
          {!isCollapsed && (
            <span className="hidden md:inline whitespace-nowrap overflow-hidden">
              Back to Dashboard
            </span>
          )}
        </Link>
      </div>
      
      <div className="flex-1 py-6 px-3 overflow-y-auto overflow-x-hidden space-y-6">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {!isCollapsed && (
              <div className="hidden md:block px-3 pb-1 text-caption font-semibold text-ink">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={item.name}
                  aria-label={item.name}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "flex items-center rounded-sm text-caption",
                    isCollapsed ? "justify-center size-10 mx-auto" : "justify-center size-10 mx-auto md:size-auto md:mx-0 md:justify-start md:gap-3 md:px-3 md:py-2",
                    isActive
                      ? "bg-parchment text-ink font-semibold"
                      : "text-ink-80"
                  )}
                >
                  <item.icon aria-hidden="true" className={clsx(
                    "size-4 shrink-0",
                    isActive ? "text-ink" : "text-ink-48"
                  )} />
                  {!isCollapsed && (
                    <span className="hidden md:inline whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="hidden md:block p-3 border-t border-hairline">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          className={clsx(
            "press flex items-center justify-center size-10 rounded-full text-ink-48 mx-auto cursor-pointer",
            !isCollapsed && "ml-auto mr-0"
          )}
        >
          {isCollapsed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </nav>
  );
}
