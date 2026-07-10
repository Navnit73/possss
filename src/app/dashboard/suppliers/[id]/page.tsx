"use client";

import { useState, useEffect, use } from "react";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft, Edit, History } from "lucide-react";

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
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (error || !supplier) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error || "Supplier not found"}</div>
        <Link href="/dashboard/suppliers" className="mt-4 inline-block text-primary hover:underline">Return to Suppliers</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/suppliers"
            className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">{supplier.name}</h1>
            <p className="text-muted-foreground mt-1">Supplier Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/suppliers/purchase-history?supplierId=${id}`}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors font-medium"
          >
            <History className="w-4 h-4" />
            Purchase History
          </Link>
          <Link
            href={`/dashboard/suppliers/${id}/edit`}
            className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-md hover:bg-primary/20 transition-colors font-medium"
          >
            <Edit className="w-4 h-4" />
            Edit Supplier
          </Link>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 border-b border-border/50 pb-2">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-sm text-muted-foreground block">Email</span>
            <span className="font-medium">{supplier.email || "-"}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground block">Phone Number</span>
            <span className="font-medium">{supplier.phone || "-"}</span>
          </div>
          <div className="md:col-span-2">
            <span className="text-sm text-muted-foreground block">Address</span>
            <span className="font-medium">{supplier.address || "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
