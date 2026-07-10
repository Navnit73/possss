"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  Factory,
  Activity
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/dashboard/products", icon: Package },
  { name: "Categories", href: "/dashboard/products/categories", icon: Tags },
  { name: "Manufacturers", href: "/dashboard/products/manufacturers", icon: Factory },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-surface border-r border-border min-h-screen flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="w-6 h-6" />
          <span className="font-display font-bold text-lg tracking-tight">Pharmacy POS</span>
        </div>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          // Exact match for dashboard so it doesn't stay highlighted on sub-routes,
          // but partial match for products so it stays highlighted on /products/add
          const isActive = item.href === "/dashboard" 
            ? pathname === item.href 
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className={clsx("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
