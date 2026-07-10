"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema } from "@/lib/validations";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import * as z from "zod";

type ProductFormType = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: ProductFormType & { _id?: string };
  isEdit?: boolean;
}

export function ProductForm({ initialData, isEdit }: ProductFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormType>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: initialData || {
      requires_prescription: false,
      minimum_stock: 0,
      tax_rate: 0,
      status: "ACTIVE"
    }
  });

  const [editLogs, setEditLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promises: any[] = [
          axios.get("/api/categories"),
          axios.get("/api/manufacturers")
        ];
        
        if (isEdit && initialData?._id) {
          promises.push(axios.get(`/api/products/${initialData._id}/logs`));
        }

        const results = await Promise.all(promises);
        setCategories(results[0].data);
        setManufacturers(results[1].data);
        
        if (results[2]) {
          setEditLogs(results[2].data);
        }

        // Re-apply initialData now that options exist
        if (initialData) {
          reset(initialData);
        }
      } catch (err) {
        console.error("Failed to load select data", err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [isEdit, initialData, reset]);

  const onSubmit = async (data: ProductFormType) => {
    setIsSubmitting(true);
    setError("");
    try {
      if (isEdit && initialData?._id) {
        await axios.put(`/api/products/${initialData._id}`, data);
      } else {
        await axios.post("/api/products", data);
      }
      router.push("/dashboard/products");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save product");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Basic Information */}
        <div className="bg-surface border border-border rounded-sm p-6 ">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Medicine Name *</label>
              <input 
                {...register("name")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Paracetamol 500mg Tablet"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Generic Name</label>
              <input 
                {...register("generic_name")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Acetaminophen"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Brand</label>
              <input 
                {...register("brand")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Tylenol"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Category *</label>
              <select 
                {...register("category_id")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                disabled={isLoadingData}
              >
                <option value="">Select Category...</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-sm text-red-500 mt-1">{errors.category_id.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Manufacturer *</label>
              <select 
                {...register("manufacturer_id")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                disabled={isLoadingData}
              >
                <option value="">Select Manufacturer...</option>
                {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
              {errors.manufacturer_id && <p className="text-sm text-red-500 mt-1">{errors.manufacturer_id.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Barcode (UPC/EAN)</label>
              <input 
                {...register("barcode")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Scan or enter barcode"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">SKU (Internal Code)</label>
              <input 
                {...register("sku")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. MED-001"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Regulatory & Compliance */}
        <div className="bg-surface border border-border rounded-sm p-6 ">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Regulatory & Compliance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Schedule Class</label>
              <select 
                {...register("schedule_class")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Non-scheduled</option>
                <option value="Schedule H">Schedule H</option>
                <option value="Schedule H1">Schedule H1</option>
                <option value="Schedule X">Schedule X</option>
                <option value="Schedule II">Schedule II</option>
                <option value="Schedule III">Schedule III</option>
                <option value="Schedule IV">Schedule IV</option>
                <option value="Schedule V">Schedule V</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">HSN / Tax Code</label>
              <input 
                {...register("hsn_code")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 3004"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">NDC Code</label>
              <input 
                {...register("ndc_code")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 12345-6789-01"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Clinical & Administration */}
        <div className="bg-surface border border-border rounded-sm p-6 ">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Clinical & Administration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Strength</label>
              <input 
                {...register("strength")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 500mg, 10ml"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Dosage Form</label>
              <select 
                {...register("dosage_form")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Select Form...</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Ointment">Ointment</option>
                <option value="Drops">Drops</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">Route of Admin</label>
              <select 
                {...register("route_of_administration")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Select Route...</option>
                <option value="Oral">Oral</option>
                <option value="Intravenous">Intravenous (IV)</option>
                <option value="Intramuscular">Intramuscular (IM)</option>
                <option value="Topical">Topical</option>
                <option value="Ophthalmic">Ophthalmic</option>
                <option value="Otic">Otic</option>
                <option value="Subcutaneous">Subcutaneous</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="text-sm font-medium text-foreground">Active Ingredients</label>
              <input 
                {...register("active_ingredients")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Amoxicillin, Clavulanate Potassium"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Storage Conditions</label>
              <select 
                {...register("storage_conditions")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Room Temperature</option>
                <option value="Refrigerated (2-8°C)">Refrigerated (2-8°C)</option>
                <option value="Frozen">Frozen</option>
                <option value="Protect from Light">Protect from Light</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">Pregnancy Category</label>
              <select 
                {...register("pregnancy_category")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Unknown / N/A</option>
                <option value="Category A">Category A</option>
                <option value="Category B">Category B</option>
                <option value="Category C">Category C</option>
                <option value="Category D">Category D</option>
                <option value="Category X">Category X</option>
              </select>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <input 
                type="checkbox"
                id="requires_prescription"
                {...register("requires_prescription")}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
              />
              <label htmlFor="requires_prescription" className="text-sm font-medium text-foreground select-none cursor-pointer">
                Requires Prescription (Rx)
              </label>
            </div>
          </div>
        </div>

        {/* Section 4: Packaging & Dispensing */}
        <div className="bg-surface border border-border rounded-sm p-6 ">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Packaging & Dispensing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Unit of Measure (UOM) *</label>
              <select 
                {...register("unit_of_measure")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Select Base Unit...</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="gm">Gram (gm)</option>
                <option value="Vial">Vial</option>
                <option value="Ampoule">Ampoule</option>
                <option value="Piece">Piece</option>
              </select>
              {errors.unit_of_measure && <p className="text-sm text-red-500 mt-1">{errors.unit_of_measure.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Package Type</label>
              <select 
                {...register("package_type")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Select Type...</option>
                <option value="Strip">Strip</option>
                <option value="Blister Pack">Blister Pack</option>
                <option value="Bottle">Bottle</option>
                <option value="Box">Box</option>
                <option value="Tube">Tube</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Package Size</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input 
                  type="number"
                  min="1"
                  {...register("package_size")}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 10"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">units per pack</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Inventory Settings */}
        <div className="bg-surface border border-border rounded-sm p-6 ">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Inventory Settings</h2>
          
          <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/10 text-sm text-primary/80">
            <strong>Note:</strong> Product Master does not store quantity. Stock levels are managed separately by receiving Inventory Batches.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Rack Number</label>
              <input 
                {...register("rack_number")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. A1, Shelf 3"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Pharmacy storage location.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Minimum Stock Alert</label>
              <input 
                type="number"
                {...register("minimum_stock")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Alerts when total stock falls below this level.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
              <input 
                type="number"
                step="0.01"
                {...register("tax_rate")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              <select 
                {...register("status")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 pb-6">
          <Link 
            href="/dashboard/products"
            className="px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={isSubmitting || isLoadingData}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : (isEdit ? "Update Product" : "Save Product")}
          </button>
        </div>
      </form>
      
      {isEdit && editLogs.length > 0 && (
        <div className="bg-surface border border-border rounded-sm p-6  mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Edit History</h2>
          <div className="space-y-4">
            {editLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border/50">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-foreground">Updated by {log.userName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Changes:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {Object.entries(log.details.changes || {}).map(([field, vals]: [string, any]) => (
                        <li key={field}>
                          <span className="capitalize">{field.replace(/_/g, " ")}</span>: 
                          <span className="line-through mx-1 text-red-400">{String(vals.old || "None")}</span> 
                          <span>&rarr;</span> 
                          <span className="ml-1 text-green-600 font-medium">{String(vals.new || "None")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
