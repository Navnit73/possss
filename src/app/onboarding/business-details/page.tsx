"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { businessDetailsSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";

type FormValues = z.infer<typeof businessDetailsSchema>;

export default function BusinessDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: {
      country: "USA",
      currency: "USD",
      timezone: "America/New_York",
    }
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError("");
    try {
      await axios.put("/api/onboarding", { step: "business-details", data });
      router.push("/onboarding/subscription");
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SplitLayout title="Business details" subtitle="Step 2 of 3: Regional settings for your pharmacy.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
        
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Country</label>
          <select 
            {...register("country")}
            className="w-full px-4 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="USA">United States</option>
            <option value="CAN">Canada</option>
            <option value="GBR">United Kingdom</option>
            <option value="AUS">Australia</option>
          </select>
          {errors.country && <p className="text-sm text-red-500">{errors.country.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Currency</label>
          <select 
            {...register("currency")}
            className="w-full px-4 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="USD">USD ($)</option>
            <option value="CAD">CAD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AUD">AUD ($)</option>
          </select>
          {errors.currency && <p className="text-sm text-red-500">{errors.currency.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Timezone</label>
          <select 
            {...register("timezone")}
            className="w-full px-4 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="America/New_York">Eastern Time (US & Canada)</option>
            <option value="America/Chicago">Central Time (US & Canada)</option>
            <option value="America/Denver">Mountain Time (US & Canada)</option>
            <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
          </select>
          {errors.timezone && <p className="text-sm text-red-500">{errors.timezone.message}</p>}
        </div>

        <button 
          disabled={isLoading}
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Continue to Subscription"}
        </button>
      </form>
    </SplitLayout>
  );
}
