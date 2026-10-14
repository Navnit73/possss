import React from "react";
import { Activity } from "lucide-react";

/**
 * Onboarding chassis: centered single column on the white canvas (max 980px), brand mark,
 * caption step indicator with a thin progress bar, display-lg title and body subtitle.
 */
export function OnboardingStep({
  step,
  total = 3,
  title,
  subtitle,
  children,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="w-full max-w-[980px] mx-auto px-4 sm:px-6 py-12 lg:py-20">
        <div className="flex items-center justify-center gap-2 text-ink mb-12">
          <Activity className="size-5" aria-hidden="true" />
          <span className="text-body font-semibold">Pharmacy POS</span>
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 space-y-2">
            <p className="text-caption text-ink-48">Step {step} of {total}</p>
            <div
              className="h-1 w-full rounded-full bg-divider-soft overflow-hidden"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={step}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${(step / total) * 100}%` }} />
            </div>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-display-lg text-ink">{title}</h1>
            {subtitle && <p className="text-body text-ink-48 mt-3">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
