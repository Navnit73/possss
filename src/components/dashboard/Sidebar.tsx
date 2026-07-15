"use client";

import { useState } from "react";
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
  UserCircle
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
    ]
  }
];

import { hasPermissionSync } from "@/lib/rbac";
import { Session } from "next-auth";

export function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter groups and items based on permissions
  const filteredGroups = navGroups.map(group => {
    const items = group.items.filter(item => {
      if (item.name === "Overview") return hasPermissionSync(session, "REPORTS", "VIEW");
      if (item.name === "Launch POS") return hasPermissionSync(session, "SALES", "CREATE") || hasPermissionSync(session, "SALES", "VIEW");
      if (item.name === "Account Settings") return true;
      
      if (group.title === "Alerts") return hasPermissionSync(session, "INVENTORY", "VIEW");
      if (group.title === "Product Master") return hasPermissionSync(session, "PRODUCTS", "VIEW");
      if (group.title === "Inventory") return hasPermissionSync(session, "INVENTORY", "VIEW");
      if (group.title === "Analytics") return hasPermissionSync(session, "REPORTS", "VIEW");
      if (group.title === "Customers") return hasPermissionSync(session, "CUSTOMERS", "VIEW");

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
        <div className={clsx(
          "flex items-center text-primary-foreground",
          isCollapsed ? "justify-center" : "gap-3"
        )}>
          <Activity className="w-6 h-6 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-display font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden">
              Pharmacy POS
            </span>
          )}
        </div>
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
              const isActive = item.href === "/dashboard" 
                ? pathname === item.href 
                : pathname.startsWith(item.href);

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
