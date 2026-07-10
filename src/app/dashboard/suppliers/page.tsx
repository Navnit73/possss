"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, Search, Eye, Edit, Truck } from "lucide-react";
import { Supplier } from "@/lib/validations";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await axios.get("/api/suppliers");
        setSuppliers(res.data);
      } catch (err) {
        console.error("Failed to fetch suppliers", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone && s.phone.includes(search))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Suppliers"
        description="Manage your suppliers and vendors."
        actions={
          <Link
            href="/dashboard/suppliers/add"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Link>
        }
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col ">
        <div className="p-4 border-b border-border bg-secondary/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name, email, or phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No suppliers found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {search ? "Try adjusting your search terms." : "Your supplier list is empty. Add a supplier to get started."}
            </p>
            {!search && (
              <Link
                href="/dashboard/suppliers/add"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Add Your First Supplier
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-sm font-semibold text-foreground">Supplier Name</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Phone</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Email</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Address</th>
                  <th className="p-4 text-sm font-semibold text-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSuppliers.map((s) => (
                  <tr key={s._id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="p-4">
                      <p className="font-medium text-foreground">{s.name}</p>
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {s.phone || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {s.email || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-4 text-sm text-foreground max-w-xs truncate" title={s.address}>
                      {s.address || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link 
                        href={`/dashboard/suppliers/${s._id}`}
                        className="inline-flex items-center justify-center p-2 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link 
                        href={`/dashboard/suppliers/${s._id}/edit`}
                        className="inline-flex items-center justify-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Edit Supplier"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
