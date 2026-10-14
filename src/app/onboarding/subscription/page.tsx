"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { SplitLayout } from "@/components/auth/SplitLayout";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { PLAN, PLAN_PRICE_LABEL } from "@/lib/billing";

export default function SubscriptionPage() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState("");

  const onActivated = async () => {
    // Re-read the store status from the database so the proxy lets us through to the dashboard
    await update();
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <SplitLayout title="Start your subscription" subtitle="Step 3 of 3: One simple plan, everything included.">
      <div className="space-y-6">
        {error && <div role="alert" className="p-3 text-sm text-red-600 bg-red-500/10 rounded-md border border-red-500/20">{error}</div>}

        <div className="p-5 border rounded-lg border-primary bg-primary/5 ring-1 ring-primary">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-display font-semibold text-lg text-foreground">{PLAN.name} Plan</h3>
              <p className="text-primary font-bold">
                {PLAN_PRICE_LABEL}<span className="text-sm font-medium text-muted-foreground"> / month</span>
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {PLAN.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <SubscribeButton label={`Subscribe — ${PLAN_PRICE_LABEL}/month`} onActivated={onActivated} onError={setError} />
        <p className="text-xs text-center text-muted-foreground">
          Billed monthly via Razorpay. Cancel anytime from Account → Subscription.
        </p>
      </div>
    </SplitLayout>
  );
}
