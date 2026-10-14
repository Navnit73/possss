"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import Swal from "sweetalert2";
import { CheckCircle2, AlertCircle, Loader2, CalendarClock } from "lucide-react";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { PAID_STATUSES } from "@/lib/billing";

interface SubscriptionInfo {
  configured: boolean;
  plan: { name: string; amount: number; currency: string; interval: string; features: string[] };
  subscription: { status: string; current_end: string | null; charge_at: string | null; paid_count: number; cancel_requested: boolean } | null;
  lapsed: boolean;
  can_manage: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "text-emerald-500" },
  authenticated: { label: "Active", className: "text-emerald-500" },
  pending: { label: "Payment failed – retrying", className: "text-amber-500" },
  paused: { label: "Paused", className: "text-amber-500" },
  halted: { label: "Suspended – payment failed", className: "text-red-500" },
  cancelled: { label: "Cancelled", className: "text-red-500" },
  completed: { label: "Completed", className: "text-red-500" },
  expired: { label: "Expired", className: "text-red-500" },
  created: { label: "Awaiting payment", className: "text-amber-500" },
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
    await update();
    router.refresh();
  };

  const manage = async (action: "cancel" | "resume") => {
    if (action === "cancel") {
      const confirm = await Swal.fire({
        title: "Cancel subscription?",
        text: "Your plan stays active until the end of the current billing period, then won't renew.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Yes, cancel renewal",
        cancelButtonText: "Keep subscription",
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
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading subscription…
      </div>
    );
  }

  const sub = info?.subscription;
  const isPaid = !!sub && PAID_STATUSES.includes(sub.status as any);
  const needsPlan = !sub || (info?.lapsed ?? false) || sub.status === "created";
  const statusInfo = sub ? STATUS_LABELS[sub.status] ?? { label: sub.status, className: "text-muted-foreground" } : null;
  const nextDate = formatDate(sub?.charge_at ?? sub?.current_end ?? null);
  const endDate = formatDate(sub?.current_end ?? null);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">Manage your pharmacy POS plan and billing.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {info && !info.configured && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-sm flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Online payments aren&apos;t configured yet (missing Razorpay keys). Subscribing is unavailable.
        </div>
      )}

      {info?.lapsed && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-sm text-sm">
          Your subscription is inactive, so the POS, inventory and reports are locked. Subscribe again to restore access — your data is safe.
        </div>
      )}

      {info && (
        <div className="bg-surface border border-primary rounded-sm shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{info.plan.name} Plan</h2>
              {statusInfo && (
                <p className="text-sm text-muted-foreground mt-1">
                  Status: <span className={`font-medium ${statusInfo.className}`}>{statusInfo.label}</span>
                </p>
              )}
              {isPaid && !sub?.cancel_requested && nextDate && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <CalendarClock className="w-4 h-4" /> Next billing date: {nextDate}
                </p>
              )}
              {isPaid && sub?.cancel_requested && endDate && (
                <p className="text-sm text-amber-600 flex items-center gap-1.5 mt-1">
                  <CalendarClock className="w-4 h-4" /> Cancelled — access continues until {endDate}
                </p>
              )}
              {sub?.status === "cancelled" && endDate && !info.lapsed && (
                <p className="text-sm text-amber-600 mt-1">Access continues until {endDate}</p>
              )}
            </div>
            <div className="md:text-right">
              <div className="text-3xl font-bold">
                ${info.plan.amount} <span className="text-sm text-muted-foreground font-normal">/ month</span>
              </div>
            </div>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3">
            {info.plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {info.can_manage ? (
            <div className="pt-2 border-t border-border space-y-3">
              {needsPlan && info.configured && (
                <div className="max-w-sm pt-4">
                  <SubscribeButton label={`Subscribe — $${info.plan.amount}/month`} onActivated={onActivated} onError={setError} />
                </div>
              )}
              {isPaid && !sub?.cancel_requested && (
                <button
                  onClick={() => manage("cancel")}
                  disabled={working}
                  className="mt-4 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Cancel subscription
                </button>
              )}
              {isPaid && sub?.cancel_requested && (
                <button
                  onClick={() => manage("resume")}
                  disabled={working}
                  className="mt-4 px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  Keep my subscription
                </button>
              )}
            </div>
          ) : (
            <p className="pt-4 border-t border-border text-sm text-muted-foreground">Only the store owner can change the subscription.</p>
          )}
        </div>
      )}
    </div>
  );
}
