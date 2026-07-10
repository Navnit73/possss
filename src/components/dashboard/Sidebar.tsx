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
  BarChart3
} from "lucide-react";
import clsx from "clsx";

const navGroups = [
  {
    title: "Main",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Launch POS", href: "/pos/sell", icon: MonitorPlay },
    ]
  },
  {
    title: "Alerts",
    items: [
      { name: "Low Stock", href: "/dashboard/inventory/alerts", icon: AlertTriangle },
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

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className={clsx(
        "bg-indigo-950 text-indigo-50 border-r border-indigo-900/50 min-h-screen flex flex-col transition-all duration-300 ease-in-out relative shadow-xl shadow-indigo-950/20",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className={clsx(
        "h-16 flex items-center border-b border-indigo-900/50 transition-all duration-300",
        isCollapsed ? "justify-center px-0" : "px-6"
      )}>
        <div className={clsx(
          "flex items-center text-indigo-400",
          isCollapsed ? "justify-center" : "gap-3"
        )}>
          <Activity className="w-6 h-6 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap overflow-hidden">
              Pharmacy POS
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-1 py-6 px-2 overflow-y-auto overflow-x-hidden space-y-6">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-4 text-[10px] font-bold text-indigo-300/50 uppercase tracking-widest mb-2">
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
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-200 group",
                    isCollapsed ? "justify-center p-2.5 mx-auto" : "gap-3 px-3 py-2.5 mx-1",
                    isActive 
                      ? "bg-indigo-600/20 text-indigo-200" 
                      : "text-indigo-200/70 hover:bg-indigo-900/40 hover:text-indigo-100"
                  )}
                >
                  <item.icon className={clsx(
                    "w-5 h-5 flex-shrink-0 transition-colors", 
                    isActive ? "text-indigo-300" : "text-indigo-300/60 group-hover:text-indigo-200"
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

      <div className="p-2 border-t border-indigo-900/50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={clsx(
            "flex items-center justify-center p-2 rounded-lg text-indigo-300/70 hover:bg-indigo-900/40 hover:text-indigo-100 transition-colors mx-auto",
            isCollapsed ? "w-10" : "w-full"
          )}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
