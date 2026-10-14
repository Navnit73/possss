import Link from "next/link";
import { ArrowLeft, MonitorPlay, FileText, Undo2, LogOut } from "lucide-react";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";
import { NavLink } from "@/components/ui/NavLink";
import { auth, signOut } from "@/auth";

const tabBase = "px-2 sm:px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400";
const tabActive = "font-extrabold bg-emerald-600 text-white shadow-2xs hover:bg-emerald-500";
const tabInactive = "font-bold text-slate-300 hover:text-white hover:bg-slate-700/60";

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
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-3 sm:px-4 sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {canOpenDashboard && (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                title="Return to Dashboard"
                aria-label="Return to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <div className="h-4 w-px bg-slate-800 hidden sm:block" aria-hidden="true"></div>
            </>
          )}

          <span className="font-display font-black tracking-tight text-white flex items-center gap-1.5 text-xs sm:text-sm">
            <MonitorPlay className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Pharmacy POS</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active tab follows the current route (previously "Sell" was highlighted on every POS page) */}
          <nav aria-label="POS" className="flex items-center gap-1 bg-slate-800/80 p-0.5 sm:p-1 rounded-lg border border-slate-700/60">
            <NavLink href="/pos/sell" className={tabBase} activeClassName={tabActive} inactiveClassName={tabInactive}>
              Sell
            </NavLink>
            <NavLink
              href="/pos/invoices"
              aria-label="Invoices"
              className={tabBase}
              activeClassName={tabActive}
              inactiveClassName={tabInactive}
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Invoices</span>
            </NavLink>
            <NavLink
              href="/pos/returns"
              aria-label="Returns"
              className={tabBase}
              activeClassName={tabActive}
              inactiveClassName={tabInactive}
            >
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Returns</span>
            </NavLink>
          </nav>

          <div className="h-4 w-px bg-slate-800" aria-hidden="true"></div>

          <CurrencyDropdown variant="dark" />

          <div className="h-4 w-px bg-slate-800 hidden lg:block" aria-hidden="true"></div>

          <div className="flex items-center gap-2">
            <div className="text-right hidden lg:block">
              <p className="font-bold text-white text-xs leading-none">{session?.user?.name || "Staff"}</p>
              <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider mt-0.5 font-mono">
                {(session?.user as any)?.role || "Staff"}
              </p>
            </div>
            <form action={async () => {
              "use server";
              await signOut();
            }}>
              <button
                type="submit"
                className="text-slate-400 hover:text-rose-400 transition-colors flex items-center justify-center p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                title="Logout"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
