import Link from "next/link";
import { BarChart3, TrendingUp, Package, AlertCircle, ArrowUpRight, ArrowDownRight, Users, Settings } from "lucide-react";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tabs = [
    { name: "Sales", href: "/dashboard/reports/sales", icon: TrendingUp },
    { name: "Profit & Loss", href: "/dashboard/reports/profit-loss", icon: BarChart3 },
    { name: "Inventory Value", href: "/dashboard/reports/inventory-value", icon: Package },
    { name: "Expiry", href: "/dashboard/reports/expiry", icon: AlertCircle },
    { name: "Fast Moving", href: "/dashboard/reports/fast-moving", icon: ArrowUpRight },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Business insights and inventory tracking.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shrink-0"
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex-1 bg-slate-50 p-6">
        {children}
      </div>
    </div>
  );
}
