"use client";

import { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: 0,
    features: ["Single Store", "Basic POS", "Up to 500 Products", "Email Support"],
  },
  {
    name: "Professional",
    price: 49,
    features: ["Single Store", "Advanced POS & Inventory", "Unlimited Products", "Custom Roles & Staff", "Priority Support"],
    popular: true,
  },
  {
    name: "Business",
    price: 99,
    features: ["Multi-Store Support", "API Access", "Custom Integrations", "Dedicated Account Manager"],
  }
];

export default function SubscriptionPage() {
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/account/subscription");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentSub(data);
    } catch (err: any) {
      setError(err.message || "Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading subscription...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Plan</h1>
        <p className="text-muted-foreground">Manage your pharmacy POS billing and subscription.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {currentSub && (
        <div className="bg-surface border border-border rounded-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Current Plan: <span className="text-primary">{currentSub.plan}</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Status: <span className="text-emerald-500 font-medium">{currentSub.status}</span>
            </p>
            {currentSub.amount > 0 && (
              <p className="text-sm text-muted-foreground">
                Next billing date: {new Date(currentSub.next_billing_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              ${currentSub.amount.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">/ month</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {PLANS.map((plan) => {
          const isCurrent = currentSub?.plan === plan.name;
          
          return (
            <div 
              key={plan.name}
              className={`bg-surface rounded-sm border ${
                plan.popular ? "border-primary shadow-sm relative" : "border-border"
              } p-6 flex flex-col`}
            >
              {plan.popular && (
                <span className="absolute -top-3 inset-x-0 mx-auto w-fit px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full uppercase tracking-wider">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="my-4">
                <span className="text-3xl font-bold">${plan.price.toLocaleString()}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled
                className={`w-full py-2.5 rounded-sm font-medium transition-colors ${
                  isCurrent 
                    ? "bg-muted text-muted-foreground cursor-not-allowed border border-border" 
                    : "bg-secondary text-secondary-foreground cursor-not-allowed opacity-70"
                }`}
              >
                {isCurrent ? "Current Plan" : "Contact support to upgrade"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
