import { NavLink } from "@/components/ui/NavLink";

const tabs = [
  { name: "Sales", href: "/dashboard/reports/sales" },
  { name: "Profit & Loss", href: "/dashboard/reports/profit-loss" },
  { name: "Inventory Value", href: "/dashboard/reports/inventory-value" },
  { name: "Expiry", href: "/dashboard/reports/expiry" },
  { name: "Fast Moving", href: "/dashboard/reports/fast-moving" },
];

// Server Component: only the tab highlight needs the pathname, which NavLink handles client-side.
// sub-nav-frosted: 52px Parchment-80% bar with backdrop blur, sticky under the 44px global nav.
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="frosted sticky top-11 z-30 border-b border-hairline print:hidden">
        <div className="max-w-[1440px] mx-auto h-13 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          <h1 className="text-tagline text-ink shrink-0">Reports</h1>
          <nav aria-label="Reports" className="flex items-center gap-5 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <NavLink
                key={tab.name}
                href={tab.href}
                className="text-caption shrink-0 whitespace-nowrap"
                activeClassName="text-ink font-semibold"
                inactiveClassName="text-ink-80"
              >
                {tab.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
        {children}
      </div>
    </div>
  );
}
