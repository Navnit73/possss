"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { businessDetailsSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import axios from "axios";
import { Loader2 } from "lucide-react";

type FormValues = z.infer<typeof businessDetailsSchema>;

interface CountryOption {
  name: string;
  defaultCurrency: string;
  defaultTimezone: string;
}

const COUNTRIES: CountryOption[] = [
  { name: "United States", defaultCurrency: "USD", defaultTimezone: "America/New_York" },
  { name: "India", defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata" },
  { name: "United Kingdom", defaultCurrency: "GBP", defaultTimezone: "Europe/London" },
  { name: "Canada", defaultCurrency: "CAD", defaultTimezone: "America/Toronto" },
  { name: "Australia", defaultCurrency: "AUD", defaultTimezone: "Australia/Sydney" },
  { name: "United Arab Emirates", defaultCurrency: "AED", defaultTimezone: "Asia/Dubai" },
  { name: "Saudi Arabia", defaultCurrency: "SAR", defaultTimezone: "Asia/Riyadh" },
  { name: "Germany", defaultCurrency: "EUR", defaultTimezone: "Europe/Berlin" },
  { name: "France", defaultCurrency: "EUR", defaultTimezone: "Europe/Paris" },
  { name: "Singapore", defaultCurrency: "SGD", defaultTimezone: "Asia/Singapore" },
  { name: "New Zealand", defaultCurrency: "NZD", defaultTimezone: "Pacific/Auckland" },
  { name: "Japan", defaultCurrency: "JPY", defaultTimezone: "Asia/Tokyo" },
  { name: "Switzerland", defaultCurrency: "CHF", defaultTimezone: "Europe/Zurich" },
  { name: "South Africa", defaultCurrency: "ZAR", defaultTimezone: "Africa/Johannesburg" },
  { name: "Nigeria", defaultCurrency: "NGN", defaultTimezone: "Africa/Lagos" },
  { name: "Kenya", defaultCurrency: "KES", defaultTimezone: "Africa/Nairobi" },
  { name: "Brazil", defaultCurrency: "BRL", defaultTimezone: "America/Sao_Paulo" },
  { name: "Mexico", defaultCurrency: "MXN", defaultTimezone: "America/Mexico_City" },
  { name: "Philippines", defaultCurrency: "PHP", defaultTimezone: "Asia/Manila" },
  { name: "Pakistan", defaultCurrency: "PKR", defaultTimezone: "Asia/Karachi" },
  { name: "Bangladesh", defaultCurrency: "BDT", defaultTimezone: "Asia/Dhaka" },
  { name: "Ethiopia", defaultCurrency: "ETB", defaultTimezone: "Africa/Addis_Ababa" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India - IST (Asia/Kolkata)" },
  { value: "America/New_York", label: "US - Eastern (America/New_York)" },
  { value: "America/Chicago", label: "US - Central (America/Chicago)" },
  { value: "America/Denver", label: "US - Mountain (America/Denver)" },
  { value: "America/Los_Angeles", label: "US - Pacific (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "US - Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "US - Hawaii (Pacific/Honolulu)" },
  { value: "Europe/London", label: "UK - London (Europe/London)" },
  { value: "America/Toronto", label: "Canada - Eastern (America/Toronto)" },
  { value: "America/Vancouver", label: "Canada - Pacific (America/Vancouver)" },
  { value: "Australia/Sydney", label: "Australia - Sydney (Australia/Sydney)" },
  { value: "Australia/Melbourne", label: "Australia - Melbourne (Australia/Melbourne)" },
  { value: "Australia/Perth", label: "Australia - Perth (Australia/Perth)" },
  { value: "Asia/Dubai", label: "UAE - Dubai (Asia/Dubai)" },
  { value: "Asia/Riyadh", label: "Saudi Arabia - Riyadh (Asia/Riyadh)" },
  { value: "Europe/Berlin", label: "Germany - Berlin (Europe/Berlin)" },
  { value: "Europe/Paris", label: "France - Paris (Europe/Paris)" },
  { value: "Asia/Singapore", label: "Singapore (Asia/Singapore)" },
  { value: "Pacific/Auckland", label: "New Zealand - Auckland (Pacific/Auckland)" },
  { value: "Asia/Tokyo", label: "Japan - Tokyo (Asia/Tokyo)" },
  { value: "Europe/Zurich", label: "Switzerland - Zurich (Europe/Zurich)" },
  { value: "Africa/Johannesburg", label: "South Africa - Johannesburg (Africa/Johannesburg)" },
  { value: "Africa/Lagos", label: "Nigeria - Lagos (Africa/Lagos)" },
  { value: "Africa/Nairobi", label: "Kenya - Nairobi (Africa/Nairobi)" },
  { value: "America/Sao_Paulo", label: "Brazil - Sao Paulo (America/Sao_Paulo)" },
  { value: "America/Mexico_City", label: "Mexico - Mexico City (America/Mexico_City)" },
  { value: "Asia/Manila", label: "Philippines - Manila (Asia/Manila)" },
  { value: "Asia/Karachi", label: "Pakistan - Karachi (Asia/Karachi)" },
  { value: "Asia/Dhaka", label: "Bangladesh - Dhaka (Asia/Dhaka)" },
  { value: "Africa/Addis_Ababa", label: "Ethiopia - Addis Ababa (Africa/Addis_Ababa)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

export default function BusinessDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);

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

