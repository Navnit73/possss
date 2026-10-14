"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Edit, 
  AlertTriangle, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/Page";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export default function ViewProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/api/products/${id}`);
        setProduct(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch product details");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </PageShell>
    );
  }

  if (error || !product) {
    return (
      <PageShell className="max-w-4xl">
        <Alert variant="destructive">{error || "Product not found"}</Alert>
        <Link href="/dashboard/products" className={buttonClasses({ variant: "outline" })}>
          Return to Products Catalog
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Top Header */}
      <PageHeader 
        title={product.name}
        description={product.generic_name ? `Generic Name: ${product.generic_name}` : "Product Details Catalog Master"}
        backHref="/dashboard/products"
        backLabel="Products"
        actions={
          <>
            <Link href={`/dashboard/inventory/add-stock?product_id=${id}`} className={buttonClasses({ variant: "outline" })}>
              <Plus aria-hidden="true" /> Receive Stock
            </Link>
            <Link href={`/dashboard/products/${id}/edit`} className={buttonClasses()}>
              <Edit aria-hidden="true" /> Edit Product
            </Link>
          </>
        }
      />

      {/* Highlights Summary Header Banner */}
      <Card className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-tagline text-ink">{product.name}</h2>
            {product.strength && <Badge variant="outline">{product.strength}</Badge>}
          </div>
          <p className="text-caption text-ink-48 mt-1">
            Category: <span className="font-semibold text-ink">{product.category?.name || "Uncategorized"}</span>
            {product.manufacturer?.name && (
              <span className="ml-3">
                Manufacturer: <span className="font-semibold text-ink">{product.manufacturer.name}</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.requires_prescription ? (
            <Badge variant="destructive">
              <AlertTriangle aria-hidden="true" /> Rx Prescription Required
            </Badge>
          ) : (
            <Badge variant="success">
              <ShieldCheck aria-hidden="true" /> OTC Product
            </Badge>
          )}

          <Badge variant={product.status === "ACTIVE" ? "success" : "destructive"}>
            {product.status === "ACTIVE" ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
            {product.status || "ACTIVE"}
          </Badge>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Basic Product Information */}
        <SpecCard title="Basic Master Info">
          <SpecRow label="Category" value={product.category?.name || "Uncategorized"} />
          <SpecRow label="Manufacturer" value={product.manufacturer?.name || "-"} />
          <SpecRow label="Generic Name" value={product.generic_name || "-"} />
          <SpecRow label="Brand" value={product.brand || "-"} />
          <SpecRow label="SKU Code" value={product.sku || "-"} mono />
          <SpecRow label="Barcode" value={product.barcode || "-"} mono />
        </SpecCard>

        {/* 2. Clinical & Administration */}
        <SpecCard title="Clinical & Pharmacology">
          <SpecRow label="Strength" value={product.strength || "-"} />
          <SpecRow label="Dosage Form" value={product.dosage_form || "-"} />
          <SpecRow label="Route of Administration" value={product.route_of_administration || "-"} />
          <SpecRow label="Storage Conditions" value={product.storage_conditions || "-"} />
          <SpecRow label="Pregnancy Category" value={product.pregnancy_category || "-"} />
          <SpecRow
            label="Prescription Mandatory"
            value={product.requires_prescription ? "Yes (Rx Required)" : "No (Over The Counter)"}
            valueClassName={cn("font-semibold", product.requires_prescription ? "text-destructive" : "text-success")}
          />
          <SpecRow label="Active Ingredients" value={product.active_ingredients || "-"} />
        </SpecCard>

        {/* 3. Regulatory & Packaging */}
        <SpecCard title="Regulatory & Packaging">
          <SpecRow label="Schedule Classification" value={product.schedule_class || "-"} />
          <SpecRow label="HSN Code" value={product.hsn_code || "-"} mono />
          <SpecRow label="NDC Code" value={product.ndc_code || "-"} mono />
          <SpecRow label="Dispense Unit (UOM)" value={product.unit_of_measure || "-"} />
          <SpecRow label="Package Type" value={product.package_type || "-"} />
          <SpecRow label="Package Size" value={`${product.package_size || 1} units`} valueClassName="tabular" />
        </SpecCard>

        {/* 4. Inventory Settings */}
        <SpecCard title="Inventory & Tax Controls">
          <SpecRow label="Rack / Shelf Location" value={product.rack_number || "Unassigned"} />
          <SpecRow label="Minimum Reorder Alert Threshold" value={`${product.minimum_stock || 0} units`} valueClassName="tabular" />
          <SpecRow label="Applicable Tax Rate" value={`${product.tax_rate || 0}%`} valueClassName="tabular" />
          <SpecRow
            label="Product Active Status"
            value={product.status || "ACTIVE"}
            valueClassName={cn("font-semibold", product.status === "ACTIVE" ? "text-success" : "text-destructive")}
          />
        </SpecCard>
      </div>
    </PageShell>
  );
}

/** Spec sheet card: tagline title over a definition list with soft row rules. */
function SpecCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-divider-soft">{children}</dl>
      </CardContent>
    </Card>
  );
}

function SpecRow({
  label,
  value,
  mono = false,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-caption text-ink-48 shrink-0">{label}</dt>
      <dd className={cn("text-body text-ink text-right min-w-0 break-words", mono && "font-mono text-caption", valueClassName)}>
        {value}
      </dd>
    </div>
  );
}
