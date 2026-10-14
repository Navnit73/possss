"use client";

import { useState, useEffect, use } from "react";
import axios from "axios";
import Link from "next/link";
import { Edit, History } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/Page";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";

export default function ViewSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [supplier, setSupplier] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await axios.get(`/api/suppliers/${id}`);
        setSupplier(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch supplier");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchSupplier();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-2.75rem)] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <PageShell className="max-w-4xl">
        <Alert variant="destructive">
          <p className="font-semibold">Error</p>
          <p>{error || "Supplier not found"}</p>
          <Link href="/dashboard/suppliers" className="text-primary hover:underline mt-2 inline-block">Return to Suppliers</Link>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader 
        title={supplier.name}
        description="Supplier Details"
        backHref="/dashboard/suppliers"
        backLabel="Suppliers"
        actions={
          <>
            <Link
              href={`/dashboard/suppliers/purchase-history?supplierId=${id}`}
              className={buttonClasses({ variant: "outline" })}
            >
              <History aria-hidden="true" />
              Purchase History
            </Link>
            <Link
              href={`/dashboard/suppliers/${id}/edit`}
              className={buttonClasses({ variant: "outline" })}
            >
              <Edit aria-hidden="true" />
              Edit Supplier
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-caption text-ink-48">Email</dt>
              <dd className="text-body text-ink mt-0.5 break-words">{supplier.email || "-"}</dd>
            </div>
            <div>
              <dt className="text-caption text-ink-48">Phone Number</dt>
              <dd className="text-body text-ink mt-0.5">{supplier.phone || "-"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-caption text-ink-48">Address</dt>
              <dd className="text-body text-ink mt-0.5">{supplier.address || "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </PageShell>
  );
}
