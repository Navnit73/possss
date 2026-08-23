import Link from "next/link";
import { ArrowLeft, MonitorPlay, FileText, Undo2 } from "lucide-react";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";

import { auth, signOut } from "@/auth";
import { LogOut } from "lucide-react";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="h-5 w-px bg-slate-800"></div>
          <span className="font-display font-black tracking-tight text-white flex items-center gap-2 text-sm">
            <MonitorPlay className="w-5 h-5 text-emerald-400" />
            Pharmacy POS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-lg border border-slate-800">
            <Link
              href="/pos/sell"
              className="px-3.5 py-1 rounded-md text-xs font-extrabold bg-emerald-600 text-white shadow-2xs transition-all"
            >
              Sell
            </Link>
            <Link
              href="/pos/invoices"
              className="px-3.5 py-1 rounded-md text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Invoices
            </Link>
            <Link
              href="/pos/returns"
              className="px-3.5 py-1 rounded-md text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Returns
            </Link>
          </nav>
          
          <div className="h-5 w-px bg-slate-800"></div>

          <CurrencyDropdown variant="dark" />

          <div className="h-5 w-px bg-slate-800"></div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-white text-xs leading-none">{session?.user?.name}</p>
              <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider mt-0.5 font-mono">
                {(session?.user as any)?.role || "Staff"}
              </p>
            </div>
            <form action={async () => {
              "use server";
              await signOut();
            }}>
              <button type="submit" className="text-slate-400 hover:text-rose-400 transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-slate-800 cursor-pointer" title="Logout">
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
