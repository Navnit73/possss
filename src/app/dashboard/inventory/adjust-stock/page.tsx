"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";

const adjustSchema = z.object({
  batch_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Batch"),
  movement_type: z.enum(["SALE", "DAMAGE", "RETURN", "ADJUSTMENT"]),
  quantity: z.coerce.number().refine(val => val !== 0, "Quantity cannot be zero"),
  notes: z.string().optional(),
});

type AdjustFormType = z.infer<typeof adjustSchema>;

export default function AdjustStockPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, formState: { errors } } = useForm<AdjustFormType>({
    resolver: zodResolver(adjustSchema) as any,
    defaultValues: {
      movement_type: "DAMAGE",
      quantity: -1,
    }
  });

  const watchMovement = watch("movement_type");

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get("/api/inventory/batches");
        setBatches(res.data);
      } catch (err) {
        console.error("Failed to load batches", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBatches();
  }, []);

  // Group batches by product name for better dropdown UI
  const groupedBatches = batches.reduce((acc: any, batch: any) => {
    const pName = batch.product?.name || "Unknown Product";
    if (!acc[pName]) acc[pName] = [];
    acc[pName].push(batch);
    return acc;
  }, {});

  const onSubmit = async (data: AdjustFormType) => {
    setIsSubmitting(true);
    setError("");
    try {
      await axios.post("/api/inventory/adjust", data);
      router.push("/dashboard/inventory/stock-list");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to adjust stock");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/inventory/stock-list"
          className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Adjust Stock</h1>
          <p className="text-muted-foreground mt-1">Record manual adjustments, damages, or corrections.</p>
        </div>
      </div>

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Important:</strong> Quantity should be the <em>delta</em>. For example, to deduct 5 damaged items, enter <code>-5</code>. To add 2 found items, enter <code>2</code>.
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-surface border border-border rounded-lg p-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="text-sm font-medium text-foreground">Select Batch *</label>
            <select 
              {...register("batch_id")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              disabled={isLoading}
            >
              <option value="">Select a batch to adjust...</option>
              {Object.entries(groupedBatches).map(([pName, pBatches]: [string, any]) => (
                <optgroup key={pName} label={pName}>
                  {pBatches.map((b: any) => (
                    <option key={b._id} value={b._id}>
                      Batch: {b.batch_number} (Current Qty: {b.qty_available})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.batch_id && <p className="text-sm text-red-500 mt-1">{errors.batch_id.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Movement Type *</label>
            <select 
              {...register("movement_type")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
            >
              <option value="DAMAGE">Damage</option>
              <option value="SALE">Sale (Manual)</option>
              <option value="RETURN">Return</option>
              <option value="ADJUSTMENT">Stock Correction / Adjustment</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Quantity Offset *</label>
            <input 
              type="number"
              step="any"
              {...register("quantity")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="-5.5 or +5.5"
            />
            {errors.quantity && <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Reason / Notes</label>
            <textarea 
              {...register("notes")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
              placeholder="Explain why this adjustment is being made..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
          <Link 
            href="/dashboard/inventory/stock-list"
            className="px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Settings2 className="w-4 h-4" />
            {isSubmitting ? "Processing..." : "Confirm Adjustment"}
          </button>
        </div>
      </form>
    </div>
  );
}
