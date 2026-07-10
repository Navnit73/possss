"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, TrendingUp, Package, AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Sales", href: "/dashboard/reports/sales", icon: TrendingUp },
    { name: "Profit & Loss", href: "/dashboard/reports/profit-loss", icon: BarChart3 },
    { name: "Inventory Value", href: "/dashboard/reports/inventory-value", icon: Package },
    { name: "Expiry", href: "/dashboard/reports/expiry", icon: AlertCircle },
    { name: "Fast Moving", href: "/dashboard/reports/fast-moving", icon: ArrowUpRight },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 ">
      <div className="bg-white border-b border-zinc-200 px-8 pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Reports & Analytics</h1>
          <p className="text-zinc-500 mt-1">Business insights and inventory tracking.</p>
        </div>
        <div className="flex gap-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 pb-3 text-sm font-semibold transition-colors shrink-0 border-b-2",
                  isActive
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 p-8">
        {children}
      </div>
    </div>
  );
}
