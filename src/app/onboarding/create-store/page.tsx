"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createStoreSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";

type FormValues = z.infer<typeof createStoreSchema>;

export default function CreateStorePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(createStoreSchema)
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError("");
    try {
      await axios.post("/api/onboarding", data);
      router.push("/onboarding/business-details");
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SplitLayout title="Name your pharmacy" subtitle="Step 1 of 3: Let's start with your business name.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
        
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Business Name</label>
          <input 
            {...register("business_name")}
            type="text"
            placeholder="e.g. Healthy Care Pharmacy"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.business_name && <p className="text-sm text-red-500">{errors.business_name.message}</p>}
        </div>

        <button 
          disabled={isLoading}
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Continue to Business Details"}
        </button>
      </form>
    </SplitLayout>
  );
}
