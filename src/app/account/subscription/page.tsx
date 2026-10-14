"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import Swal, { destructiveSwalClasses } from "@/lib/swal";
import { CheckCircle2, Loader2, CalendarClock } from "lucide-react";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/Page";
import { PAID_STATUSES } from "@/lib/billing";

interface SubscriptionInfo {
  configured: boolean;
  plan: { name: string; amount: number; currency: string; interval: string; features: string[] };
  subscription: { status: string; current_end: string | null; charge_at: string | null; paid_count: number; cancel_requested: boolean } | null;
  lapsed: boolean;
  can_manage: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  authenticated: { label: "Active", className: "text-success" },
  pending: { label: "Payment failed – retrying", className: "text-warning" },
  paused: { label: "Paused", className: "text-warning" },
  halted: { label: "Suspended – payment failed", className: "text-destructive" },
  cancelled: { label: "Cancelled", className: "text-destructive" },
  completed: { label: "Completed", className: "text-destructive" },
  expired: { label: "Expired", className: "text-destructive" },
  created: { label: "Awaiting payment", className: "text-warning" },
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;

export default function SubscriptionPage() {
  const router = useRouter();
  const { update } = useSession();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get<SubscriptionInfo>("/api/account/subscription");
      setInfo(data);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onActivated = async () => {
    await load();
    // Clears the "locked" flag on this session so the rest of the app opens up immediately
    await update({});
    router.refresh();
  };

  const manage = async (action: "cancel" | "resume") => {
    if (action === "cancel") {
      const confirm = await Swal.fire({
        title: "Cancel subscription?",
        text: "Your plan stays active until the end of the current billing period, then won't renew.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, cancel renewal",
        cancelButtonText: "Keep subscription",
        customClass: destructiveSwalClasses,
      });
      if (!confirm.isConfirmed) return;
    }
    setWorking(true);
    try {
      await axios.post("/api/account/subscription/manage", { action });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not update your subscription");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div role="status" className="flex items-center gap-2 text-caption text-ink-48">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading subscription…
        </div>
      </PageShell>
    );
  }

  const sub = info?.subscription;
  const isPaid = !!sub && PAID_STATUSES.includes(sub.status as any);
  // A cancelled plan can't be resumed on Razorpay, so it gets a fresh checkout (billing starts when the paid time runs out)
  const needsPlan = !sub || (info?.lapsed ?? false) || sub.status === "created" || sub.status === "cancelled";
  const resubscribing = !!sub && sub.status !== "created" && needsPlan;
  const resubscribeBeforeEnd = sub?.status === "cancelled" && !info?.lapsed;
  const statusInfo = sub ? STATUS_LABELS[sub.status] ?? { label: sub.status, className: "text-ink-48" } : null;
  const nextDate = formatDate(sub?.charge_at ?? sub?.current_end ?? null);
  const endDate = formatDate(sub?.current_end ?? null);

  return (
    <PageShell>
      <PageHeader title="Subscription" description="Manage your Medishelf POS plan and billing." />

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {info && !info.configured && (
        <Alert variant="warning">
          Online payments aren&apos;t configured yet (missing Razorpay keys). Subscribing is unavailable.
        </Alert>
      )}

      {info?.lapsed && (
        <Alert variant="destructive">
          Your subscription is inactive, so the POS, inventory and reports are locked. Subscribe again to restore access — your data is safe.
        </Alert>
      )}

      {info && (
        <Card className="border-2 border-primary-focus p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h2 className="text-tagline text-ink">{info.plan.name} Plan</h2>
              {statusInfo && (
                <p className="text-caption text-ink-48 mt-2">
                  Status: <span className={`font-semibold ${statusInfo.className}`}>{statusInfo.label}</span>
                </p>
              )}
              {isPaid && !sub?.cancel_requested && nextDate && (
                <p className="text-caption text-ink-48 flex items-center gap-1.5 mt-1">
                  <CalendarClock className="size-4" aria-hidden="true" /> Next billing date: {nextDate}
                </p>
              )}
              {isPaid && sub?.cancel_requested && endDate && (
                <p className="text-caption text-warning flex items-center gap-1.5 mt-1">
                  <CalendarClock className="size-4" aria-hidden="true" /> Cancelled — access continues until {endDate}
                </p>
              )}
              {sub?.status === "cancelled" && endDate && !info.lapsed && (
                <p className="text-caption text-warning mt-1">Access continues until {endDate}</p>
              )}
            </div>
            <div className="md:text-right">
              <div className="text-display-md leading-tight text-ink tabular">
                ${info.plan.amount} <span className="text-caption text-ink-48">/ month</span>
              </div>
            </div>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3">
            {info.plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-caption text-ink-80">
                <CheckCircle2 className="size-4 text-success mt-0.5 shrink-0" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {info.can_manage ? (
            <div className="pt-6 border-t border-divider-soft space-y-3">
              {needsPlan && info.configured && (
                <div className="max-w-sm space-y-2">
                  <SubscribeButton
                    label={`${resubscribing ? "Subscribe again" : "Subscribe"} — $${info.plan.amount}/month`}
                    onActivated={onActivated}
                    onError={setError}
                  />
                  {resubscribeBeforeEnd && endDate && (
                    <p className="text-caption text-ink-48">You won&apos;t be charged until your current period ends on {endDate}.</p>
                  )}
                </div>
              )}
              {isPaid && !sub?.cancel_requested && (
                <Button
                  variant="link"
                  onClick={() => manage("cancel")}
                  disabled={working}
                  className="text-caption text-destructive"
                >
                  Cancel subscription
                </Button>
              )}
              {isPaid && sub?.cancel_requested && (
                <Button
                  onClick={() => manage("resume")}
                  loading={working}
                >
                  Keep my subscription
                </Button>
              )}
            </div>
          ) : (
            <p className="pt-6 border-t border-divider-soft text-caption text-ink-48">Only the store owner can change the subscription.</p>
          )}
        </Card>
      )}
    </PageShell>
  );
}
