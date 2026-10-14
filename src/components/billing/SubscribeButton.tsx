"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { PAID_STATUSES } from "@/lib/billing";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: any) => void) => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let checkoutScript: Promise<void> | null = null;
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) {
    checkoutScript = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = CHECKOUT_SRC;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        checkoutScript = null; // allow a retry after a network failure
        el.remove();
        reject(new Error("Could not load the payment window. Check your connection and try again."));
      };
      document.body.appendChild(el);
    });
  }
  return checkoutScript;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Props {
  label: string;
  onActivated: () => void | Promise<void>;
  onError?: (message: string) => void;
  className?: string;
}

export function SubscribeButton({ label, onActivated, onError, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const inFlight = useRef(false);

  const fail = (message: string) => {
    setStatus("");
    onError?.(message);
  };

  // Razorpay confirms the first charge asynchronously; wait briefly for the webhook/API to flip the status.
  const waitUntilActive = async (): Promise<boolean> => {
    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const { data } = await axios.get("/api/account/subscription");
      if (data?.subscription && PAID_STATUSES.includes(data.subscription.status)) return true;
    }
    return false;
  };

  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setStatus("Preparing secure checkout…");
    onError?.("");

    const finish = () => {
      inFlight.current = false;
      setBusy(false);
    };

    try {
      const [{ data: checkout }] = await Promise.all([axios.post("/api/account/subscription"), loadCheckoutScript()]);

      const rzp = new window.Razorpay!({
        key: checkout.key_id,
        subscription_id: checkout.subscription_id,
        name: "Pharmacy POS",
        description: "Pro plan — $49 / month",
        prefill: checkout.prefill,
        theme: { color: "#0f172a" },
        modal: {
          ondismiss: () => {
            setStatus("");
            finish();
          },
        },
        handler: async (response: Record<string, string>) => {
          setStatus("Confirming your payment…");
          try {
            const res = await axios.post("/api/account/subscription/verify", response, { validateStatus: (s) => s === 200 || s === 202 });
            const active = res.status === 200 || (await waitUntilActive());
            if (!active) {
              fail("Your payment is still being confirmed. This page will update shortly — refresh in a minute.");
              return;
            }
            setStatus("Payment confirmed!");
            await onActivated();
          } catch (err: any) {
            fail(err.response?.data?.error || "We couldn't confirm your payment. If you were charged, it will be applied automatically.");
          } finally {
            finish();
          }
        },
      });

      rzp.on("payment.failed", (r: any) => {
        // Checkout stays open so the customer can retry with another method
        onError?.(r?.error?.description || "Payment failed. Please try another payment method.");
      });
      setStatus("");
      rzp.open();
    } catch (err: any) {
      fail(err.response?.data?.error || err.message || "Could not start checkout.");
      finish();
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          className ??
          "w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        }
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {busy ? status || "Please wait…" : label}
      </button>
    </div>
  );
}
