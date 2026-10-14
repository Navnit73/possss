"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  Factory,
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PlusCircle,
  Settings2,
  History,
  AlertTriangle,
  Truck,
  MonitorPlay,
  BarChart3,
  Users,
  UserCircle,
  Menu,
  X
} from "lucide-react";
import clsx from "clsx";

const navGroups = [
  {
    title: "Main",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Launch POS", href: "/pos/sell", icon: MonitorPlay },
      { name: "Account Settings", href: "/account/profile", icon: Users },
    ]
  },
  {
    title: "Alerts",
    items: [
      { name: "Low Stock", href: "/dashboard/inventory/alerts", icon: AlertTriangle },
    ]
  },
  {
    title: "Customers",
    items: [
      { name: "Customers", href: "/dashboard/customers", icon: UserCircle },
    ]
  },
  {
    title: "Product Master",
    items: [
      { name: "Products", href: "/dashboard/products", icon: Package },
      { name: "Categories", href: "/dashboard/products/categories", icon: Tags },
      { name: "Manufacturers", href: "/dashboard/products/manufacturers", icon: Factory },
      { name: "Suppliers", href: "/dashboard/suppliers", icon: Truck },
    ]
  },
  {
    title: "Inventory",
    items: [
      { name: "Stock List", href: "/dashboard/inventory/stock-list", icon: ClipboardList },
      { name: "Receive Stock", href: "/dashboard/inventory/add-stock", icon: PlusCircle },
      { name: "Adjust Stock", href: "/dashboard/inventory/adjust-stock", icon: Settings2 },
      { name: "Stock Ledger", href: "/dashboard/inventory/history", icon: History },
    ]
  },
  {
    title: "Analytics",
    items: [
      { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
      { name: "Audit Logs", href: "/dashboard/audit-logs", icon: Activity },
    ]
  },
  {
    title: "Settings",
    items: [
      { name: "Report Settings", href: "/dashboard/settings/reports", icon: Settings2 },
    ]
  }
];

import { hasPermissionSync } from "@/lib/rbac";
import { Session } from "next-auth";

export function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close the mobile drawer whenever the route changes (adjust state during render, no effect needed)
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsMobileOpen(false);
  }

  // Mobile drawer: Escape to close, lock body scroll, move focus in and restore it on close
  useEffect(() => {
    if (!isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
        return;
      }
      // Keep Tab focus inside the drawer while it is open
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusables = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("a[href], button"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const menuButton = menuButtonRef.current;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [isMobileOpen]);

  // Filter groups and items based on permissions (kept in sync with the route guards in auth.config.ts
  // and the API permission checks, so we never show a link that just bounces the user elsewhere)
  const filteredGroups = navGroups.map(group => {
    const items = group.items.filter(item => {
      if (item.name === "Overview") return hasPermissionSync(session, "REPORTS", "VIEW");
      if (item.name === "Launch POS") return hasPermissionSync(session, "SALES", "CREATE") || hasPermissionSync(session, "SALES", "VIEW");
      if (item.name === "Account Settings") return true;
      
      if (group.title === "Alerts") return hasPermissionSync(session, "INVENTORY", "VIEW");
      if (group.title === "Product Master") return hasPermissionSync(session, "PRODUCTS", "VIEW");
      if (group.title === "Inventory") return hasPermissionSync(session, "INVENTORY", "VIEW");
      if (group.title === "Analytics") {
        // /api/audit-logs requires AUDIT_LOGS:VIEW; a role check alone showed the link to managers who'd get a 403
        if (item.name === "Audit Logs") return hasPermissionSync(session, "AUDIT_LOGS", "VIEW");
        return hasPermissionSync(session, "REPORTS", "VIEW");
      }
      if (group.title === "Customers") return hasPermissionSync(session, "CUSTOMERS", "VIEW");
      if (group.title === "Settings") return hasPermissionSync(session, "SETTINGS", "VIEW") || ["OWNER", "MANAGER"].includes((session?.user as any)?.role);

      return false;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  // Highlight only the most specific matching item, so "/dashboard/products/categories"
  // doesn't also light up "Products".
  const activeHref = filteredGroups
    .flatMap(group => group.items.map(item => item.href))
    .filter(href => href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  // On mobile the drawer always shows labels, regardless of the desktop collapsed state
  const renderNav = (collapsed: boolean) => (
    <>
      <div className={clsx(
        "h-16 flex items-center border-b border-white/10 transition-all duration-300 shrink-0",
        collapsed ? "justify-center px-0" : "px-6"
      )}>
        <div className={clsx(
          "flex items-center text-primary-foreground",
          collapsed ? "justify-center" : "gap-3"
        )}>
          <Activity className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span className="font-display font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden">
              Pharmacy POS
            </span>
          )}
        </div>
      </div>
      
      <nav aria-label="Main navigation" className="flex-1 py-6 px-2 overflow-y-auto overflow-x-hidden space-y-6">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <div className="px-4 text-[10px] font-bold text-primary-foreground/50 uppercase tracking-widest mb-2">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = item.href === activeHref;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  aria-label={collapsed ? item.name : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "flex items-center rounded-sm text-sm font-medium transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                    collapsed ? "justify-center p-2.5 mx-auto" : "gap-3 px-3 py-2.5 mx-1",
                    isActive 
                      ? "bg-white/10 text-white" 
                      : "text-primary-foreground/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon aria-hidden="true" className={clsx(
                    "w-5 h-5 flex-shrink-0 transition-colors", 
                    isActive ? "text-white" : "text-primary-foreground/60 group-hover:text-white"
                  )} />
                  {!collapsed && (
                    <span className="whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile menu trigger: sits in the (empty) left slot of the sticky Header */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg text-foreground bg-surface border border-border hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open navigation menu"
        aria-expanded={isMobileOpen}
        aria-controls="dashboard-mobile-nav"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            id="dashboard-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative h-full w-72 max-w-[85vw] bg-primary text-primary-foreground flex flex-col animate-in"
          >
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-sm text-primary-foreground/70 hover:bg-white/10 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            {renderNav(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar: sticky so it stays in view while long pages scroll */}
      <aside 
        className={clsx(
          "hidden lg:flex bg-primary text-primary-foreground border-r border-border h-screen sticky top-0 flex-col shrink-0 transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {renderNav(isCollapsed)}

        <div className="p-2 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            className={clsx(
              "flex items-center justify-center p-2 rounded-sm text-primary-foreground/70 hover:bg-white/5 hover:text-white transition-colors mx-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              isCollapsed ? "w-10" : "w-full"
            )}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" aria-hidden="true" /> : <ChevronLeft className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </aside>
    </>
  );
}
