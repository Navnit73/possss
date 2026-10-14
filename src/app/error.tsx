"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";

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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 sm:px-6 py-20">
      <div role="alert" className="max-w-[640px] w-full text-center">
        <AlertTriangle className="size-5 text-destructive mx-auto mb-6" aria-hidden="true" />

        <h1 className="text-display-lg text-ink mb-4">Something went wrong</h1>
        <p className="text-body text-ink-48 mb-8">
          An unexpected error occurred. Please try again or return to the main dashboard.
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <div className="p-4 mb-8 bg-parchment text-left text-caption font-mono text-ink rounded-sm overflow-auto max-h-32">
            {error.message}
          </div>
        )}

        {error.digest && (
          <p className="text-fine-print text-ink-48 mb-8">
            Reference: <span className="font-mono select-all">{error.digest}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button type="button" onClick={() => retry()}>
            <RefreshCw aria-hidden="true" />
            Try Again
          </Button>
          {/* "/" routes each role to its own landing page (cashiers to POS, others to the dashboard) */}
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            <Home aria-hidden="true" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
