"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { batchSchema } from "@/lib/validations";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import * as z from "zod";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type BatchFormType = z.infer<typeof batchSchema>;

export default function AddStockPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<BatchFormType>({
    resolver: zodResolver(batchSchema) as any,
    defaultValues: {
      product_id: "",
      qty_available: 0,
      cost_price: 0,
      selling_price: 0,
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, suppRes] = await Promise.all([
          axios.get("/api/products"),
          axios.get("/api/suppliers")
        ]);
        setProducts(prodRes.data);
        setSuppliers(suppRes.data);
        
        // Auto-select product if passed in URL
        const params = new URLSearchParams(window.location.search);
        const pid = params.get("product_id");
        if (pid) {
          setValue("product_id", pid);
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [setValue]);

  const onSubmit = async (data: BatchFormType) => {
    setIsSubmitting(true);
    setError("");
    try {
      await axios.post("/api/inventory/batches", data);
      router.push("/dashboard/inventory/stock-list");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add stock");
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
          <h1 className="text-3xl font-display font-bold text-foreground">Receive New Stock</h1>
          <p className="text-muted-foreground mt-1">Add a new batch of product to inventory.</p>
        </div>
      </div>

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-surface border border-border rounded-lg p-6 ">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="text-sm font-medium text-foreground">Product *</label>
            <div className="mt-1.5">
              <Controller
                name="product_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={products.map((p: any) => ({ label: `${p.name} ${p.strength ? `(${p.strength})` : ""}`, value: p._id }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search and select product..."
                    disabled={isLoading}
                  />
                )}
              />
            </div>
            {errors.product_id && <p className="text-sm text-red-500 mt-1">{errors.product_id.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Batch Number *</label>
            <input 
              {...register("batch_number")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. BATCH-001"
            />
            {errors.batch_number && <p className="text-sm text-red-500 mt-1">{errors.batch_number.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Supplier</label>
            <div className="mt-1.5">
              <Controller
                name="supplier"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={suppliers.map((s: any) => ({ label: s.name, value: s.name }))}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Search and select supplier..."
                    disabled={isLoading}
                  />
                )}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Quantity Received *</label>
            <input 
              type="number"
              step="any"
              {...register("qty_available")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.qty_available && <p className="text-sm text-red-500 mt-1">{errors.qty_available.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Expiry Date</label>
            <input 
              type="date"
              {...register("expiry_date")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Cost Price</label>
            <input 
              type="number"
              step="0.01"
              {...register("cost_price")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Selling Price</label>
            <input 
              type="number"
              step="0.01"
              {...register("selling_price")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            <Plus className="w-4 h-4" />
            {isSubmitting ? "Saving..." : "Add Stock"}
          </button>
        </div>
      </form>
    </div>
  );
}
