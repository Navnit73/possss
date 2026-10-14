"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // Next 16: retry() re-fetches and re-renders the segment (reset() only clears client state,
  // so a Server Component error would just throw again).
  retry: () => void;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div role="alert" className="max-w-md w-full bg-surface rounded-2xl border border-border p-8 text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-8 h-8" aria-hidden="true" />
        </div>
        
        <h1 className="text-2xl font-black text-foreground mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6">
          An unexpected error occurred. Please try again or return to the main dashboard.
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <div className="p-3 mb-6 bg-muted border border-border text-left text-xs font-mono text-foreground rounded-lg overflow-auto max-h-32">
            {error.message}
          </div>
        )}

        {error.digest && (
          <p className="text-[11px] text-muted-foreground mb-6">
            Reference: <span className="font-mono select-all">{error.digest}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => retry()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
          {/* "/" routes each role to its own landing page (cashiers to POS, others to the dashboard) */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
