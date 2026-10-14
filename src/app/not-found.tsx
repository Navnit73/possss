import Link from "next/link";
import { MonitorPlay, LayoutDashboard } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 sm:px-6 py-20">
      <div className="max-w-[640px] w-full text-center">
        <p className="text-caption text-ink-48 mb-3">404 error</p>
        <h1 className="text-display-lg text-ink mb-4">Page Not Found</h1>
        <p className="text-body text-ink-48 mb-8">
          The requested page or route does not exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* "/" sends each role to its landing page (cashiers would otherwise be bounced off /dashboard) */}
          <Link href="/" className={buttonClasses()}>
            <LayoutDashboard aria-hidden="true" />
            Home
          </Link>
          <Link href="/pos/sell" className={buttonClasses({ variant: "outline" })}>
            <MonitorPlay aria-hidden="true" />
            Launch POS
          </Link>
        </div>
      </div>
    </div>
  );
}
