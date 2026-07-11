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
  ChevronRight,
  ArrowLeft
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
      // Billing, Subscription, Activity Logs require SETTINGS view permission (or OWNER role which is handled by hasPermissionSync)
      if (item.name === "Subscription" || item.name === "Billing History" || item.name === "Activity Logs") {
        return hasPermissionSync(session, "SETTINGS", "VIEW");
      }
      return false;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  return (
    <div 
      className={clsx(
        "bg-primary text-primary-foreground border-r border-border min-h-screen flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className={clsx(
        "h-16 flex items-center border-b border-white/10 transition-all duration-300",
        isCollapsed ? "justify-center px-0" : "px-6"
      )}>
        <Link href="/dashboard" className="flex items-center gap-2 text-primary-foreground/70 hover:text-white transition-colors group">
          <ArrowLeft className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-medium whitespace-nowrap overflow-hidden">
              Back to Dashboard
            </span>
          )}
        </Link>
      </div>
      
      <div className="flex-1 py-6 px-2 overflow-y-auto overflow-x-hidden space-y-6">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-4 text-[10px] font-bold text-primary-foreground/50 uppercase tracking-widest mb-2">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={clsx(
                    "flex items-center rounded-sm text-sm font-medium transition-all duration-200 group",
                    isCollapsed ? "justify-center p-2.5 mx-auto" : "gap-3 px-3 py-2.5 mx-1",
                    isActive 
                      ? "bg-white/10 text-white" 
                      : "text-primary-foreground/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className={clsx(
                    "w-5 h-5 flex-shrink-0 transition-colors", 
                    isActive ? "text-white" : "text-primary-foreground/60 group-hover:text-white"
                  )} />
                  {!isCollapsed && (
                    <span className="whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-white/10">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={clsx(
            "flex items-center justify-center p-2 rounded-sm text-primary-foreground/70 hover:bg-white/5 hover:text-white transition-colors mx-auto",
            isCollapsed ? "w-10" : "w-full"
          )}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
