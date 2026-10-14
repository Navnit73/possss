"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { businessDetailsSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/context/CurrencyContext";
import { COUNTRIES, TIMEZONES } from "@/lib/regions";
import axios from "axios";
import { Loader2 } from "lucide-react";

type FormValues = z.infer<typeof businessDetailsSchema>;

export default function BusinessDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);
  const { setCurrency } = useCurrency();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: {
      country: "United States",
      currency: "USD",
      timezone: "America/New_York",
    }
  });

  // Fetch current saved store details on mount
  useEffect(() => {
    async function loadTenantDetails() {
      try {
        const res = await axios.get("/api/onboarding");
        if (res.data?.tenant) {
          const { country, currency, timezone } = res.data.tenant;
          reset({
            country: country || "United States",
            currency: currency || "USD",
            timezone: timezone || "America/New_York",
          });
        }
      } catch (e) {
        console.error("Failed to load store details:", e);
      } finally {
        setIsFetchingInitial(false);
      }
    }

    loadTenantDetails();
  }, [reset]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCountry = e.target.value;
    setValue("country", selectedCountry, { shouldValidate: true });

    const matchedCountry = COUNTRIES.find((c) => c.name === selectedCountry);
    if (matchedCountry) {
      setValue("currency", matchedCountry.defaultCurrency, { shouldValidate: true });
      setValue("timezone", matchedCountry.defaultTimezone, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError("");
    try {
      await axios.put("/api/onboarding", { step: "business-details", data });
      // Already saved on the tenant above; just update the in-app currency without a second write.
      setCurrency(data.currency, false);
      router.push("/onboarding/subscription");
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SplitLayout title="Business details" subtitle="Step 2 of 3: Regional settings for your pharmacy.">
      {isFetchingInitial ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Country</label>
            <select 
              {...register("country")}
              onChange={handleCountryChange}
              className="w-full px-4 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-foreground"
            >
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.country && <p className="text-sm text-red-500">{errors.country.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Currency</label>
            <select 
              {...register("currency")}
              className="w-full px-4 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-foreground"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} ({c.symbol}) - {c.name}
                </option>
              ))}
            </select>
            {errors.currency && <p className="text-sm text-red-500">{errors.currency.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Timezone</label>
            <select 
              {...register("timezone")}
              className="w-full px-4 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-foreground"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            {errors.timezone && <p className="text-sm text-red-500">{errors.timezone.message}</p>}
          </div>

          <button 
            disabled={isLoading}
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue to Subscription"
            )}
          </button>
        </form>
      )}
    </SplitLayout>
  );
}

