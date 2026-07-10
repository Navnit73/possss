"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { subscriptionSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";
import { Check } from "lucide-react";
import { useSession } from "next-auth/react";

type FormValues = z.infer<typeof subscriptionSchema>;

const plans = [
  { id: "basic", name: "Basic Plan", price: "$49/mo", features: ["1 Store location", "Basic inventory", "Email support"] },
  { id: "pro", name: "Pro Plan", price: "$99/mo", features: ["Up to 3 locations", "Advanced reporting", "24/7 Priority support"], popular: true },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      subscription_plan: "pro"
    }
  });

  const selectedPlan = watch("subscription_plan");

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError("");
    try {
      await axios.put("/api/onboarding", { step: "subscription", data });
      await update({ tenant_status: "ACTIVE" });
      router.push("/dashboard"); // Final redirect to actual POS dashboard
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SplitLayout title="Choose a plan" subtitle="Step 3 of 3: Select the subscription that fits your needs.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
        
        {/* Hidden input to register the field */}
        <input type="hidden" {...register("subscription_plan")} />

        <div className="grid grid-cols-1 gap-4">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div 
                key={plan.id}
                onClick={() => setValue("subscription_plan", plan.id, { shouldValidate: true })}
                className={`relative p-5 border rounded-lg cursor-pointer transition-all ${
                  isSelected 
                    ? "border-primary bg-primary/5 ring-1 ring-primary" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                {plan.popular && (
                  <span className="absolute top-0 right-4 -translate-y-1/2 bg-success text-success-foreground text-xs font-bold px-2 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-foreground">{plan.name}</h3>
                    <p className="text-primary font-bold">{plan.price}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                    isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {errors.subscription_plan && <p className="text-sm text-red-500">{errors.subscription_plan.message}</p>}

        <button 
          disabled={isLoading}
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50"
        >
          {isLoading ? "Finalizing..." : "Complete Setup"}
        </button>
      </form>
    </SplitLayout>
  );
}
