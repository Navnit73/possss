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
      <nav aria-label="Main navigation" className="flex-1 py-6 px-3 overflow-y-auto overflow-x-hidden space-y-6">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {!collapsed && (
              <div className="px-3 pb-1 text-caption font-semibold text-ink">
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
                    "flex items-center rounded-sm text-caption",
                    collapsed ? "justify-center size-10 mx-auto" : "gap-3 px-3 py-2",
                    isActive
                      ? "bg-parchment text-ink font-semibold"
                      : "text-ink-80"
                  )}
                >
                  <item.icon aria-hidden="true" className={clsx(
                    "size-4 shrink-0",
                    isActive ? "text-ink" : "text-ink-48"
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
        className="press lg:hidden fixed top-0 left-2 z-50 size-11 flex items-center justify-center text-on-dark cursor-pointer print:hidden"
        aria-label="Open navigation menu"
        aria-expanded={isMobileOpen}
        aria-controls="dashboard-mobile-nav"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            id="dashboard-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative h-full w-72 max-w-[85vw] bg-canvas text-ink flex flex-col animate-in"
          >
            <div className="h-13 shrink-0 flex items-center justify-between pl-6 pr-3 border-b border-hairline">
              <span className="text-tagline text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="press size-11 flex items-center justify-center rounded-full bg-chip/64 text-ink cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar: sticky so it stays in view while long pages scroll */}
      <aside 
        className={clsx(
          "hidden lg:flex bg-canvas text-ink border-r border-hairline h-[calc(100dvh-2.75rem)] sticky top-11 flex-col shrink-0 transition-[width] duration-300 ease-in-out print:hidden",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {renderNav(isCollapsed)}

        <div className="p-3 border-t border-hairline shrink-0">
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
      </aside>
    </>
  );
}
