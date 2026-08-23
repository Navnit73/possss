import Link from "next/link";
import { ArrowLeft, MonitorPlay, FileText, Undo2, LogOut } from "lucide-react";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";
import { auth, signOut } from "@/auth";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-3 sm:px-4 sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md hover:bg-slate-800"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          
          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
          
          <span className="font-display font-black tracking-tight text-white flex items-center gap-1.5 text-xs sm:text-sm">
            <MonitorPlay className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Pharmacy POS</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 bg-slate-800/80 p-0.5 sm:p-1 rounded-lg border border-slate-700/60">
            <Link
              href="/pos/sell"
              className="px-2.5 sm:px-3.5 py-1 rounded-md text-xs font-extrabold bg-emerald-600 text-white shadow-2xs transition-all hover:bg-emerald-500"
            >
              Sell
            </Link>
            <Link
              href="/pos/invoices"
              className="px-2 sm:px-3 py-1 rounded-md text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invoices</span>
            </Link>
            <Link
              href="/pos/returns"
              className="px-2 sm:px-3 py-1 rounded-md text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Returns</span>
            </Link>
          </nav>
          
          <div className="h-4 w-px bg-slate-800"></div>

          <CurrencyDropdown variant="dark" />

          <div className="h-4 w-px bg-slate-800 hidden lg:block"></div>

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
                className="text-slate-400 hover:text-rose-400 transition-colors flex items-center justify-center p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 cursor-pointer" 
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
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
