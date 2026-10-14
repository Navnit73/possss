import React from "react";
import { Activity, BarChart3, CalendarClock, ScanBarcode, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  { icon: ScanBarcode, title: "Fast barcode checkout", text: "Ring up sales, print receipts and take payments at the counter." },
  { icon: CalendarClock, title: "Batch & expiry tracking", text: "Get warned about short-dated and low-stock items before they cost you." },
  { icon: BarChart3, title: "Reports that add up", text: "Daily sales, margins and stock value, ready to export." },
];

/**
 * Auth chassis: a flat product-tile-dark (#272729) on the left carrying the brand headline and what the
 * product does, with the form on a white product-tile-light on the right (form stays first in the DOM so
 * keyboard and screen-reader users reach it first). No gradients, no decorative
 * blobs — the surface change is the divider.
 */
export function SplitLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) {
  return (
    <div className="min-h-dvh grid grid-cols-1 lg:grid-cols-2 bg-canvas">
      <div className="flex flex-col px-6 sm:px-12 lg:px-20 py-8 lg:py-12">
        <div className="flex items-center gap-2 text-ink">
          <Activity className="size-5" aria-hidden="true" />
          <span className="text-body font-semibold">Medishelf POS</span>
        </div>

        <main className="flex-1 flex flex-col justify-center py-10 lg:py-16">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-8">
              <h1 className="text-display-lg text-ink">{title}</h1>
              {subtitle && <p className="text-body text-ink-48 mt-3">{subtitle}</p>}
            </div>
            {children}
          </div>
        </main>

        <p className="text-fine-print text-ink-48 text-center lg:text-left">
          Need help?{" "}
          <a href="mailto:support@medishelf.co" className="text-primary hover:underline underline-offset-[3px]">support@medishelf.co</a>
        </p>
      </div>

      <aside className="hidden lg:flex lg:order-first bg-tile-1 text-on-dark flex-col justify-center px-16 xl:px-24 py-20">
        <div className="max-w-lg">
          <h2 className="text-display-lg text-on-dark">
            Precision in every prescription.
          </h2>
          <p className="text-tagline font-normal text-body-muted mt-4">
            Inventory and point of sale, built for the pharmacy counter.
          </p>

          <ul className="mt-12 space-y-7">
            {HIGHLIGHTS.map(({ icon: Icon, title: heading, text }) => (
              <li key={heading} className="flex gap-4">
                <span className="size-10 shrink-0 rounded-md bg-tile-2 border border-white/10 flex items-center justify-center">
                  <Icon className="size-5 text-primary-on-dark" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-body font-semibold text-on-dark">{heading}</p>
                  <p className="text-caption text-body-muted mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-12 pt-6 border-t border-white/10 flex items-center gap-2 text-caption text-body-muted">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Encrypted sign-in. Your store&apos;s data stays private to your team.
          </p>
        </div>
      </aside>
    </div>
  );
}
