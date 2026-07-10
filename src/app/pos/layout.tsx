import Link from "next/link";
import { ArrowLeft, MonitorPlay, FileText, Undo2 } from "lucide-react";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="h-14 bg-indigo-950 text-indigo-50 border-b border-indigo-900/50 flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-indigo-300 hover:text-indigo-100 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="h-6 w-px bg-indigo-900"></div>
          <span className="font-display font-bold tracking-tight text-white flex items-center gap-2">
            <MonitorPlay className="w-5 h-5 text-indigo-400" />
            Pharmacy POS
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <Link
            href="/pos/sell"
            className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-900/40 text-indigo-200 hover:text-indigo-100 transition-colors"
          >
            Sell
          </Link>
          <Link
            href="/pos/invoices"
            className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-900/40 text-indigo-200 hover:text-indigo-100 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Invoices
          </Link>
          <Link
            href="/pos/returns"
            className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-900/40 text-indigo-200 hover:text-indigo-100 transition-colors flex items-center gap-2"
          >
            <Undo2 className="w-4 h-4" />
            Returns
          </Link>
        </nav>
      </header>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
