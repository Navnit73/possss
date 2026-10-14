import Link from "next/link";
import { Activity, ChevronLeft, LogOut } from "lucide-react";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";
import { NavLink } from "@/components/ui/NavLink";
import { auth, signOut } from "@/auth";

// global-nav links: nav-link type (12px), white; the current tab reads in full white at 600
const tabBase = "press h-11 flex items-center px-2 sm:px-3 text-nav-link";
const tabActive = "text-on-dark font-semibold";
const tabInactive = "text-on-dark/70";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Cashiers are bounced from /dashboard straight back to /pos/sell (auth.config.ts), so don't offer the link
  const canOpenDashboard = (session?.user as any)?.role !== "CASHIER";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* global-nav: 44px, true black */}
      <header className="h-11 bg-black text-on-dark flex items-center justify-between gap-3 px-3 sm:px-6 sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          {canOpenDashboard && (
            <Link
              href="/dashboard"
              className="press flex items-center gap-0.5 text-nav-link text-on-dark/70"
              title="Return to Dashboard"
              aria-label="Return to Dashboard"
            >
              <ChevronLeft className="size-4" aria-hidden />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}

          <span className="flex items-center gap-2 text-nav-link font-semibold text-on-dark">
            <Activity className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Medishelf POS</span>
          </span>
        </div>

        <nav aria-label="POS" className="flex items-center">
          {/* Active tab follows the current route */}
          <NavLink href="/pos/sell" className={tabBase} activeClassName={tabActive} inactiveClassName={tabInactive}>
            Sell
          </NavLink>
          <NavLink href="/pos/invoices" className={tabBase} activeClassName={tabActive} inactiveClassName={tabInactive}>
            Invoices
          </NavLink>
          <NavLink href="/pos/returns" className={tabBase} activeClassName={tabActive} inactiveClassName={tabInactive}>
            Returns
          </NavLink>
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <CurrencyDropdown variant="dark" />

          <span className="hidden lg:block text-nav-link text-body-muted">
            <span className="text-on-dark">{session?.user?.name || "Staff"}</span>
            <span className="capitalize"> · {(session?.user as any)?.role?.toLowerCase() || "staff"}</span>
          </span>

          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button
              type="submit"
              className="press flex size-8 items-center justify-center rounded-full text-on-dark/80 cursor-pointer"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
