"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createStoreSchema } from "@/lib/validations";
import { OnboardingStep } from "../_components/OnboardingStep";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useSession } from "next-auth/react";
import axios from "axios";

type FormValues = z.infer<typeof createStoreSchema>;

export default function CreateStorePage() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(createStoreSchema)
  });

  // Prefill when resuming an unfinished onboarding
  useEffect(() => {
    axios.get("/api/onboarding")
      .then((res) => {
        if (res.data?.tenant?.business_name) reset({ business_name: res.data.tenant.business_name });
      })
      .catch(() => {});
  }, [reset]);

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError("");
    try {
      await axios.post("/api/onboarding", data);
      // The session was issued before this store existed; re-read it so it carries the new tenant_id
      // (otherwise the subscription step is rejected with 401).
      await update({});
      router.push("/onboarding/business-details");
      return; // stay disabled while navigating
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    }
    setIsLoading(false);
  };

  return (
    <OnboardingStep step={1} title="Name your pharmacy" subtitle="Let's start with your business name.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="business-name">Business Name</Label>
          <Input
            {...register("business_name")}
            id="business-name"
            autoComplete="organization"
            aria-invalid={!!errors.business_name}
            type="text"
            placeholder="e.g. Healthy Care Pharmacy"
          />
          {errors.business_name && <p className="text-caption text-destructive">{errors.business_name.message}</p>}
        </div>

        <Button disabled={isLoading} type="submit" className="w-full mt-3">
          {isLoading ? "Saving..." : "Continue to Business Details"}
        </Button>
      </form>
    </OnboardingStep>
  );
}
