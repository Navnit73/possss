import Link from "next/link";
import { MonitorPlay, LayoutDashboard, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-5">
          <Search className="w-8 h-8 text-slate-500" />
        </div>
        
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">404 Error</p>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The requested page or route does not exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/pos/sell"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            <MonitorPlay className="w-4 h-4" />
            Launch POS
          </Link>
        </div>
      </div>
    </div>
  );
}
