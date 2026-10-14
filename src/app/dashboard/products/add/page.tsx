"use client";

import { useState } from "react";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { BulkUploadDialog } from "@/components/products/BulkUploadDialog";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/Page";
import { useRouter } from "next/navigation";

export default function AddProductPage() {
  const router = useRouter();
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  return (
    <PageShell>
      <PageHeader 
        title="Add Product"
        description="Create a new entry in your medicine master catalog."
        backHref="/dashboard/products"
        actions={
          <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
            <Upload aria-hidden="true" />
            Bulk Upload CSV
          </Button>
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
    </PageShell>
  );
}
