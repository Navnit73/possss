import { BarChart3, TrendingUp, Package, AlertCircle, ArrowUpRight } from "lucide-react";
import { NavLink } from "@/components/ui/NavLink";

const tabs = [
  { name: "Sales", href: "/dashboard/reports/sales", icon: TrendingUp },
  { name: "Profit & Loss", href: "/dashboard/reports/profit-loss", icon: BarChart3 },
  { name: "Inventory Value", href: "/dashboard/reports/inventory-value", icon: Package },
  { name: "Expiry", href: "/dashboard/reports/expiry", icon: AlertCircle },
  { name: "Fast Moving", href: "/dashboard/reports/fast-moving", icon: ArrowUpRight },
];

// Server Component: only the tab highlight needs the pathname, which NavLink handles client-side.
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="bg-surface border-b border-border px-4 sm:px-8 pt-6 sm:pt-8 print:pt-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Business insights and inventory tracking.</p>
        </div>
        <nav aria-label="Reports" className="flex gap-6 overflow-x-auto hide-scrollbar print:hidden">
          {tabs.map((tab) => (
            <NavLink
              key={tab.name}
              href={tab.href}
              className="flex items-center gap-2 pb-3 text-sm font-semibold transition-colors shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-sm"
              activeClassName="border-primary text-foreground"
              inactiveClassName="border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.name}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex-1 p-4 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        {children}
      </div>
    </div>
  );
}
