"use client";

import { useState } from "react";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { BulkUploadDialog } from "@/components/products/BulkUploadDialog";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AddProductPage() {
  const router = useRouter();
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Add Product"
        description="Create a new entry in your medicine master catalog."
        backHref="/dashboard/products"
        actions={
          <button 
            onClick={() => setShowBulkDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors border border-border"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload CSV
          </button>
        }
      />

      <ProductForm />

      {showBulkDialog && (
        <BulkUploadDialog 
          onClose={() => setShowBulkDialog(false)}
          onSuccess={() => {
            setShowBulkDialog(false);
            router.push("/dashboard/products");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
