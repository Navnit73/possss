"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { OnboardingStep } from "../_components/OnboardingStep";
import { Alert } from "@/components/ui/Alert";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { PLAN, PLAN_PRICE_LABEL } from "@/lib/billing";

export default function SubscriptionPage() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState("");

  const onActivated = async () => {
    // Re-read the store status from the database so the proxy lets us through to the dashboard
    await update({});
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <OnboardingStep step={3} title="Start your subscription" subtitle="One simple plan, everything included.">
      <div className="space-y-6">
        {error && <Alert variant="destructive">{error}</Alert>}

        <Card className="border-2 border-primary-focus p-6" aria-current="true">
          <h3 className="text-body font-semibold text-ink">{PLAN.name} Plan</h3>
          <p className="mt-1 text-lead text-ink tabular">
            {PLAN_PRICE_LABEL}<span className="text-caption text-ink-48"> / month</span>
          </p>
          <ul className="mt-6 space-y-2 text-caption text-ink-80">
            {PLAN.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </Card>

        <SubscribeButton
          label={`Subscribe — ${PLAN_PRICE_LABEL}/month`}
          onActivated={onActivated}
          onError={setError}
          className={buttonClasses({ className: "w-full disabled:pointer-events-none disabled:opacity-40" })}
        />
        <p className="text-fine-print text-center text-ink-48">
          Billed monthly via Razorpay. Cancel anytime from Account → Subscription.
        </p>
      </div>
    </OnboardingStep>
  );
}
