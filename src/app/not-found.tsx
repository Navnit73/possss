import Link from "next/link";
import { MonitorPlay, LayoutDashboard, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-2xl border border-border p-8 text-center">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-5">
          <Search className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
        </div>
        
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">404 Error</p>
        <h1 className="text-2xl font-black text-foreground mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The requested page or route does not exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* "/" sends each role to its landing page (cashiers would otherwise be bounced off /dashboard) */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            Home
          </Link>
          <Link
            href="/pos/sell"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <MonitorPlay className="w-4 h-4" aria-hidden="true" />
            Launch POS
          </Link>
        </div>
      </div>
    </div>
  );
}
