"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, Search, Eye, Edit, Truck } from "lucide-react";
import { Supplier } from "@/lib/validations";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await axios.get("/api/suppliers");
        setSuppliers(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        console.error("Failed to fetch suppliers", err);
        setError(err.response?.data?.error || "Failed to load suppliers");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(s => 
    (s.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone && s.phone.includes(search))
  );

  return (
    <PageShell>
      <PageHeader 
        title="Suppliers"
        description="Manage your suppliers and vendors."
        actions={
          <Link href="/dashboard/suppliers/add" className={buttonClasses()}>
            <Plus aria-hidden="true" />
            Add Supplier
          </Link>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden />
        <Input
          type="text"
          aria-label="Search suppliers by name, email or phone"
          placeholder="Search by name, email, or phone..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers found"
            description={search ? "Try adjusting your search terms." : "Your supplier list is empty. Add a supplier to get started."}
            action={
              !search && (
                <Link href="/dashboard/suppliers/add" className={buttonClasses()}>
                  Add Your First Supplier
                </Link>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((s) => (
                <TableRow key={s._id}>
                  <TableCell>
                    <p className="font-semibold text-ink">{s.name}</p>
                  </TableCell>
                  <TableCell>
                    {s.phone || <span className="text-ink-48">-</span>}
                  </TableCell>
                  <TableCell>
                    {s.email || <span className="text-ink-48">-</span>}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={s.address}>
                    {s.address || <span className="text-ink-48">-</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Link 
                      href={`/dashboard/suppliers/${s._id}`}
                      className={buttonClasses({ variant: "ghost", size: "icon", className: "text-ink-48" })}
                      title="View Details"
                      aria-label={`View ${s.name}`}
                    >
                      <Eye aria-hidden="true" />
                    </Link>
                    <Link 
                      href={`/dashboard/suppliers/${s._id}/edit`}
                      className={buttonClasses({ variant: "ghost", size: "icon", className: "text-ink-48" })}
                      title="Edit Supplier"
                      aria-label={`Edit ${s.name}`}
                    >
                      <Edit aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
