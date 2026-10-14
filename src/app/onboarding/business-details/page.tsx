"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { businessDetailsSchema } from "@/lib/validations";
import { OnboardingStep } from "../_components/OnboardingStep";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/context/CurrencyContext";
import { COUNTRIES, TIMEZONES } from "@/lib/regions";
import axios from "axios";

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
      return; // stay disabled while navigating
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    }
    setIsLoading(false);
  };

  return (
    <OnboardingStep step={2} title="Business details" subtitle="Regional settings for your pharmacy.">
      {isFetchingInitial ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="space-y-2">
            <Label htmlFor="onboarding-country">Country</Label>
            <Select
              {...register("country")}
              id="onboarding-country"
              aria-invalid={!!errors.country}
              onChange={handleCountryChange}
            >
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
            {errors.country && <p className="text-caption text-destructive">{errors.country.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-currency">Currency</Label>
            <Select
              {...register("currency")}
              id="onboarding-currency"
              aria-invalid={!!errors.currency}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} ({c.symbol}) - {c.name}
                </option>
              ))}
            </Select>
            {errors.currency && <p className="text-caption text-destructive">{errors.currency.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-timezone">Timezone</Label>
            <Select
              {...register("timezone")}
              id="onboarding-timezone"
              aria-invalid={!!errors.timezone}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
            {errors.timezone && <p className="text-caption text-destructive">{errors.timezone.message}</p>}
          </div>

          <Button disabled={isLoading} loading={isLoading} type="submit" className="w-full mt-3">
            {isLoading ? "Saving..." : "Continue to Subscription"}
          </Button>
        </form>
      )}
    </OnboardingStep>
  );
}
