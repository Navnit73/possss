"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema } from "@/lib/validations";
import Link from "next/link";
import { Save } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import * as z from "zod";

type ProductFormType = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: ProductFormType & { _id?: string };
  isEdit?: boolean;
}

/**
 * Optional fields cleared earlier are stored as null in MongoDB. Zod's string/boolean schemas reject
 * null, which made such products impossible to re-save (with no visible error). Map them back to
 * form-friendly values.
 */
function normalizeInitialData(data?: ProductFormProps["initialData"]) {
  if (!data) return undefined;
  const normalized: any = { ...data };
  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === null) normalized[key] = "";
  });
  if (normalized.requires_prescription === "" || normalized.requires_prescription === undefined) normalized.requires_prescription = false;
  if (normalized.package_size === "" || normalized.package_size === undefined) normalized.package_size = 1;
  if (normalized.minimum_stock === "") normalized.minimum_stock = 0;
  if (normalized.tax_rate === "") normalized.tax_rate = 0;
  if (!normalized.status) normalized.status = "ACTIVE";
  return normalized as ProductFormType & { _id?: string };
}

export function ProductForm({ initialData: rawInitialData, isEdit }: ProductFormProps) {
  const [initialData] = useState(() => normalizeInitialData(rawInitialData));
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
      package_size: 1,
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
      } catch (err: any) {
        console.error("Failed to load select data", err);
        setError(err.response?.data?.error || "Failed to load categories and manufacturers");
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [isEdit, initialData, reset]);

  const onSubmit = async (data: ProductFormType) => {
    if (isSubmitting) return;
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
      {error && <Alert variant="destructive">{error}</Alert>}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          Please fix the highlighted fields: {Object.keys(errors).map(k => k.replace(/_/g, " ")).join(", ")}.
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Basic Information */}
        <FormSection title="Basic Information" gridClassName="md:grid-cols-2">
          <Field id="name" label="Medicine Name *" className="md:col-span-2" error={errors.name?.message}>
            <Input id="name" {...register("name")} aria-invalid={!!errors.name} placeholder="e.g. Paracetamol 500mg Tablet" />
          </Field>

          <Field id="generic_name" label="Generic Name">
            <Input id="generic_name" {...register("generic_name")} placeholder="e.g. Acetaminophen" />
          </Field>

          <Field id="brand" label="Brand">
            <Input id="brand" {...register("brand")} placeholder="e.g. Tylenol" />
          </Field>

          <Field id="category_id" label="Category *" error={errors.category_id?.message}>
            <Select id="category_id" {...register("category_id")} aria-invalid={!!errors.category_id} disabled={isLoadingData}>
              <option value="">Select Category...</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>

          <Field id="manufacturer_id" label="Manufacturer *" error={errors.manufacturer_id?.message}>
            <Select id="manufacturer_id" {...register("manufacturer_id")} aria-invalid={!!errors.manufacturer_id} disabled={isLoadingData}>
              <option value="">Select Manufacturer...</option>
              {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </Select>
          </Field>

          <Field id="barcode" label="Barcode (UPC/EAN)">
            <Input id="barcode" {...register("barcode")} className="font-mono" placeholder="Scan or enter barcode" />
          </Field>

          <Field id="sku" label="SKU (Internal Code)">
            <Input id="sku" {...register("sku")} className="font-mono" placeholder="e.g. MED-001" />
          </Field>
        </FormSection>

        {/* Section 2: Regulatory & Compliance */}
        <FormSection title="Regulatory & Compliance">
          <Field id="schedule_class" label="Schedule Class">
            <Select id="schedule_class" {...register("schedule_class")}>
              <option value="">Non-scheduled</option>
              <option value="Schedule H">Schedule H</option>
              <option value="Schedule H1">Schedule H1</option>
              <option value="Schedule X">Schedule X</option>
              <option value="Schedule II">Schedule II</option>
              <option value="Schedule III">Schedule III</option>
              <option value="Schedule IV">Schedule IV</option>
              <option value="Schedule V">Schedule V</option>
            </Select>
          </Field>
          <Field id="hsn_code" label="HSN / Tax Code">
            <Input id="hsn_code" {...register("hsn_code")} className="font-mono" placeholder="e.g. 3004" />
          </Field>
          <Field id="ndc_code" label="NDC Code">
            <Input id="ndc_code" {...register("ndc_code")} className="font-mono" placeholder="e.g. 12345-6789-01" />
          </Field>
        </FormSection>

        {/* Section 3: Clinical & Administration */}
        <FormSection title="Clinical & Administration">
          <Field id="strength" label="Strength">
            <Input id="strength" {...register("strength")} placeholder="e.g. 500mg, 10ml" />
          </Field>

          <Field id="dosage_form" label="Dosage Form">
            <Select id="dosage_form" {...register("dosage_form")}>
              <option value="">Select Form...</option>
              <option value="Tablet">Tablet</option>
              <option value="Capsule">Capsule</option>
              <option value="Syrup">Syrup</option>
              <option value="Injection">Injection</option>
              <option value="Ointment">Ointment</option>
              <option value="Drops">Drops</option>
              <option value="Inhaler">Inhaler</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
          
          <Field id="route_of_administration" label="Route of Admin">
            <Select id="route_of_administration" {...register("route_of_administration")}>
              <option value="">Select Route...</option>
              <option value="Oral">Oral</option>
              <option value="Intravenous">Intravenous (IV)</option>
              <option value="Intramuscular">Intramuscular (IM)</option>
              <option value="Topical">Topical</option>
              <option value="Ophthalmic">Ophthalmic</option>
              <option value="Otic">Otic</option>
              <option value="Subcutaneous">Subcutaneous</option>
            </Select>
          </Field>

          <Field id="active_ingredients" label="Active Ingredients" className="md:col-span-3">
            <Input id="active_ingredients" {...register("active_ingredients")} placeholder="e.g. Amoxicillin, Clavulanate Potassium" />
          </Field>

          <Field id="storage_conditions" label="Storage Conditions">
            <Select id="storage_conditions" {...register("storage_conditions")}>
              <option value="">Room Temperature</option>
              <option value="Refrigerated (2-8°C)">Refrigerated (2-8°C)</option>
              <option value="Frozen">Frozen</option>
              <option value="Protect from Light">Protect from Light</option>
            </Select>
          </Field>
          
          <Field id="pregnancy_category" label="Pregnancy Category">
            <Select id="pregnancy_category" {...register("pregnancy_category")}>
              <option value="">Unknown / N/A</option>
              <option value="Category A">Category A</option>
              <option value="Category B">Category B</option>
              <option value="Category C">Category C</option>
              <option value="Category D">Category D</option>
              <option value="Category X">Category X</option>
            </Select>
          </Field>

          <div className="flex items-center gap-3 md:mt-8">
            <input 
              type="checkbox"
              id="requires_prescription"
              {...register("requires_prescription")}
              className="accent-primary size-4 cursor-pointer"
            />
            <Label htmlFor="requires_prescription" className="font-normal select-none cursor-pointer">
              Requires Prescription (Rx)
            </Label>
          </div>
        </FormSection>

        {/* Section 4: Packaging & Dispensing */}
        <FormSection title="Packaging & Dispensing">
          <Field id="unit_of_measure" label="Unit of Measure (UOM) *" error={errors.unit_of_measure?.message}>
            <Select id="unit_of_measure" {...register("unit_of_measure")} aria-invalid={!!errors.unit_of_measure}>
              <option value="">Select Base Unit...</option>
              <option value="Tablet">Tablet</option>
              <option value="Capsule">Capsule</option>
              <option value="ml">Milliliter (ml)</option>
              <option value="gm">Gram (gm)</option>
              <option value="Vial">Vial</option>
              <option value="Ampoule">Ampoule</option>
              <option value="Piece">Piece</option>
            </Select>
          </Field>

          <Field id="package_type" label="Package Type">
            <Select id="package_type" {...register("package_type")}>
              <option value="">Select Type...</option>
              <option value="Strip">Strip</option>
              <option value="Blister Pack">Blister Pack</option>
              <option value="Bottle">Bottle</option>
              <option value="Box">Box</option>
              <option value="Tube">Tube</option>
            </Select>
          </Field>

          <Field id="package_size" label="Package Size" error={errors.package_size?.message}>
            <div className="flex items-center gap-2">
              <Input 
                id="package_size"
                type="number"
                min="1"
                {...register("package_size")}
                aria-invalid={!!errors.package_size}
                className="tabular"
                placeholder="e.g. 10"
              />
              <span className="text-caption text-ink-48 whitespace-nowrap">units per pack</span>
            </div>
          </Field>
        </FormSection>

        {/* Section 5: Inventory Settings */}
        <FormSection
          title="Inventory Settings"
          gridClassName="md:grid-cols-4"
          intro={
            <Alert>
              <strong className="font-semibold">Note:</strong> Product Master does not store quantity. Stock levels are managed separately by receiving Inventory Batches.
            </Alert>
          }
        >
          <Field id="rack_number" label="Rack Number" hint="Pharmacy storage location.">
            <Input id="rack_number" {...register("rack_number")} placeholder="e.g. A1, Shelf 3" />
          </Field>

          <Field id="minimum_stock" label="Minimum Stock Alert" error={errors.minimum_stock?.message} hint="Alerts when total stock falls below this level.">
            <Input 
              id="minimum_stock"
              type="number"
              min="0"
              {...register("minimum_stock")}
              aria-invalid={!!errors.minimum_stock}
              className="tabular"
              placeholder="0"
            />
          </Field>

          <Field id="tax_rate" label="Tax Rate (%)" error={errors.tax_rate?.message}>
            <Input 
              id="tax_rate"
              type="number"
              step="0.01"
              min="0"
              {...register("tax_rate")}
              aria-invalid={!!errors.tax_rate}
              className="tabular"
              placeholder="0.00"
            />
          </Field>

          <Field id="status" label="Status">
            <Select id="status" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </FormSection>

        <div className="frosted sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 border-t border-hairline px-8 py-3 flex justify-end gap-3">
          <Link href="/dashboard/products" className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button 
            type="submit"
            disabled={isLoadingData}
            loading={isSubmitting}
          >
            {!isSubmitting && <Save aria-hidden="true" />}
            {isSubmitting ? "Saving..." : (isEdit ? "Update Product" : "Save Product")}
          </Button>
        </div>
      </form>
      
      {isEdit && editLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Edit History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-divider-soft">
              {editLogs.map((log, index) => {
                const changes = log.details?.changes || {};
                const hasChanges = Object.keys(changes).length > 0;
                const actionLabel = log.action ? log.action.replace(/_/g, " ") : "Product Edited";

                return (
                  <li key={index} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                      <span className="text-body font-semibold text-ink">
                        {actionLabel} by {log.userName || "Staff"}
                      </span>
                      <span className="text-caption text-ink-48 tabular">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    {hasChanges ? (
                      <div className="text-caption text-ink-80">
                        <p className="font-semibold mb-1">Changes:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {Object.entries(changes).map(([field, vals]: [string, any]) => (
                            <li key={field}>
                              <span className="capitalize">{field.replace(/_/g, " ")}</span>: 
                              <span className="line-through mx-1 text-ink-48">{String(vals?.old ?? "None")}</span> 
                              <span aria-hidden="true">&rarr;</span> 
                              <span className="ml-1 text-ink font-semibold">{String(vals?.new ?? "None")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : log.after?.name ? (
                      <p className="text-caption text-ink-48">
                        Updated product details ({log.after.name})
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Form section on the store-utility-card: tagline title, then a responsive field grid. */
function FormSection({
  title,
  intro,
  gridClassName = "md:grid-cols-3",
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  gridClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {intro}
        <div className={cn("grid grid-cols-1 gap-6", gridClassName)}>{children}</div>
      </CardContent>
    </Card>
  );
}

/** Label + control + optional validation message / helper caption. */
function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-caption text-destructive">{error}</p>}
      {hint && <p className="text-caption text-ink-48">{hint}</p>}
    </div>
  );
}
