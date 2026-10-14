"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manufacturerSchema } from "@/lib/validations";
import { Plus, Factory, Edit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

type ManufacturerForm = {
  name: string;
  contact_info?: string;
};

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ManufacturerForm>({
    resolver: zodResolver(manufacturerSchema),
  });

  const fetchManufacturers = async () => {
    try {
      const res = await axios.get("/api/manufacturers");
      setManufacturers(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load manufacturers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const handleEditClick = (man: any) => {
    setEditingId(man._id);
    reset({
      name: man.name,
      contact_info: man.contact_info || "",
    });
    setIsAdding(true);
    setError("");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    reset({ name: "", contact_info: "" });
    setError("");
  };

  const onSubmit = async (data: ManufacturerForm) => {
    setError("");
    try {
      if (editingId) {
        await axios.put(`/api/manufacturers/${editingId}`, data);
      } else {
        await axios.post("/api/manufacturers", data);
      }
      handleCancel();
      fetchManufacturers();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${editingId ? "update" : "add"} manufacturer`);
    }
  };

  return (
    <PageShell>
      <PageHeader 
        title="Manufacturers"
        description="Manage pharmaceutical manufacturers and suppliers."
        actions={
          !isAdding && (
            <Button
              onClick={() => {
                setEditingId(null);
                reset({ name: "", contact_info: "" });
                setIsAdding(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add Manufacturer
            </Button>
          )
        }
      />

      {error && !isAdding && <Alert variant="destructive">{error}</Alert>}

      <Modal
        isOpen={isAdding}
        onClose={handleCancel}
        title={editingId ? "Edit Manufacturer" : "New Manufacturer"}
        className="max-w-md"
      >
        {/* Shown inside the modal: the page-level banner is hidden behind the overlay */}
        {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="manufacturer-name">Name *</Label>
            <Input 
              id="manufacturer-name"
              {...register("name")}
              placeholder="e.g. Pfizer"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-caption text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="manufacturer-contact_info">Contact Info</Label>
            <Textarea 
              id="manufacturer-contact_info"
              {...register("contact_info")}
              className="resize-none"
              placeholder="Optional contact details..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editingId ? "Update Manufacturer" : "Save Manufacturer"}
            </Button>
          </div>
        </form>
      </Modal>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={3} rows={5} />
          </div>
        ) : manufacturers.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No manufacturers yet"
            description="Add your first manufacturer to start tracking medicine origins."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manufacturers.map((man) => (
                <TableRow key={man._id}>
                  <TableCell className="font-semibold text-ink">{man.name}</TableCell>
                  <TableCell className="text-ink-48">{man.contact_info || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(man)}
                      title="Edit Manufacturer"
                      aria-label="Edit Manufacturer"
                    >
                      <Edit aria-hidden="true" />
                    </Button>
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
