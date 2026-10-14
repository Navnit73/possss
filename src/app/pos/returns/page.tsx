"use client";

import Link from "next/link";
import { Undo2, ChevronLeft, Clock } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function PosReturnsPage() {
  return (
    <div className="min-h-[calc(100dvh-2.75rem)] p-6 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full space-y-6">

        {/* Back Link */}
        <div className="flex justify-start">
          <Link
            href="/pos/sell"
            className="inline-flex items-center gap-0.5 text-caption text-primary hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Back to POS Register
          </Link>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-canvas border border-hairline rounded-lg p-10 flex flex-col items-center text-center">
          <Undo2 className="size-8 text-ink-48 mb-6" aria-hidden="true" />

          <Badge variant="warning" className="mb-4">
            <Clock aria-hidden="true" />
            Feature under development
          </Badge>

          {/* Title */}
          <h1 className="text-display-md text-ink mb-2">
            POS Sales Returns
          </h1>

          <p className="text-body text-ink-48 max-w-md mb-8">
            The Sales Returns & Refunds module is coming in future updates. You will be able to process customer medicine returns, restock inventory batches, and issue store credit or cash refunds directly.
          </p>

          {/* Feature Highlights */}
          <div className="w-full bg-parchment rounded-lg p-6 text-left space-y-2 text-caption text-ink-80 mb-8">
            <p className="text-body font-semibold text-ink mb-3">Planned capabilities</p>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-ink-48 shrink-0" aria-hidden="true" />
              <span>Full & partial receipt item returns with barcode scanning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-ink-48 shrink-0" aria-hidden="true" />
              <span>Automatic inventory batch restocking and condition audits</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-ink-48 shrink-0" aria-hidden="true" />
              <span>Refund processing via Cash, Card reversal, or Store Credit</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/pos/sell" className={buttonClasses()}>
              Go to POS Register
            </Link>
            <Link href="/pos/invoices" className={buttonClasses({ variant: "outline" })}>
              View Past Invoices
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
