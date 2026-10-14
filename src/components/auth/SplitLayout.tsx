import React from "react";
import { Activity } from "lucide-react";

/**
 * Auth chassis: form on a white product-tile-light, paired with a flat product-tile-dark
 * (#272729) carrying the brand headline. No gradients, no decorative blobs — the surface
 * change is the divider.
 */
export function SplitLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-canvas">
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-20">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-2 text-ink mb-12">
            <Activity className="size-5" aria-hidden="true" />
            <span className="text-body font-semibold">Pharmacy POS</span>
          </div>
          <div className="mb-8">
            <h1 className="text-display-lg text-ink">{title}</h1>
            {subtitle && <p className="text-body text-ink-48 mt-3">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>

      <div className="hidden lg:flex bg-tile-1 text-on-dark flex-col justify-center items-center px-20 py-20">
        <div className="max-w-lg text-center">
          <h2 className="text-display-lg text-on-dark mb-4">
            Precision in every prescription.
          </h2>
          <p className="text-lead text-body-muted">
            Inventory and point of sale, built for the pharmacy counter.
          </p>
        </div>
      </div>
    </div>
  );
}
