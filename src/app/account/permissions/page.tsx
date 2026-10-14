"use client";

import Swal, { destructiveSwalClasses } from "@/lib/swal";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Shield, X, Search, CheckSquare } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState, Chip } from "@/components/ui/Page";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

const AVAILABLE_MODULES = [
  "POS",
  "CUSTOMERS",
  "PRODUCTS",
  "INVENTORY",
  "SALES",
  "REPORTS",
  "USERS",
  "ROLES",
  "SETTINGS",
  "AUDIT_LOGS"
];

const AVAILABLE_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE"];

const PRESETS = [
  {
    name: "Senior Pharmacist",
    description: "Full access to POS, Inventory, Products, Sales, and Customer Records",
    permissions: [
      { module: "POS", action: "VIEW" }, { module: "POS", action: "CREATE" }, { module: "POS", action: "EDIT" },
      { module: "CUSTOMERS", action: "VIEW" }, { module: "CUSTOMERS", action: "CREATE" }, { module: "CUSTOMERS", action: "EDIT" },
      { module: "PRODUCTS", action: "VIEW" }, { module: "PRODUCTS", action: "CREATE" }, { module: "PRODUCTS", action: "EDIT" },
      { module: "INVENTORY", action: "VIEW" }, { module: "INVENTORY", action: "CREATE" }, { module: "INVENTORY", action: "EDIT" },
      { module: "SALES", action: "VIEW" }, { module: "REPORTS", action: "VIEW" }
    ]
  },
  {
    name: "Cashier Lead",
    description: "Access to POS Checkout, Customer Info, and Daily Sales Viewing",
    permissions: [
      { module: "POS", action: "VIEW" }, { module: "POS", action: "CREATE" },
      { module: "CUSTOMERS", action: "VIEW" }, { module: "CUSTOMERS", action: "CREATE" },
      { module: "PRODUCTS", action: "VIEW" },
      { module: "SALES", action: "VIEW" }
    ]
  },
  {
    name: "Inventory Manager",
    description: "Manage Stock, Batches, Products, Suppliers, and Purchasing",
    permissions: [
      { module: "PRODUCTS", action: "VIEW" }, { module: "PRODUCTS", action: "CREATE" }, { module: "PRODUCTS", action: "EDIT" }, { module: "PRODUCTS", action: "DELETE" },
      { module: "INVENTORY", action: "VIEW" }, { module: "INVENTORY", action: "CREATE" }, { module: "INVENTORY", action: "EDIT" }, { module: "INVENTORY", action: "DELETE" },
      { module: "REPORTS", action: "VIEW" }
    ]
  }
];

export default function PermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load roles");
      setRoles(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const url = editingRole._id ? `/api/roles/${editingRole._id}` : "/api/roles";
      const method = editingRole._id ? "PUT" : "POST";

      const payload = {
        name: editingRole.name,
        description: editingRole.description,
        permissions: editingRole.permissions || []
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save role");

      setEditingRole(null);
      Swal.fire({
        title: editingRole._id ? "Role Updated" : "Role Created",
        text: `Permissions for ${editingRole.name} updated successfully.`,
        icon: "success",
        timer: 1800,
        showConfirmButton: false
      });
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: any) => {
    const confirm = await Swal.fire({
      title: `Delete ${role.name}?`,
      text: "Users assigned to this role must be reassigned before deleting.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete Role",
      customClass: destructiveSwalClasses
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`/api/roles/${role._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        Swal.fire("Deleted!", "Role has been removed.", "success");
        fetchRoles();
      } catch (err: any) {
        Swal.fire("Delete Failed", String(err.message), "error");
      }
    }
  };

  const togglePermission = (module: string, action: string) => {
    const permissions = [...(editingRole.permissions || [])];
    const index = permissions.findIndex(p => p.module === module && p.action === action);
    
    if (index >= 0) {
      permissions.splice(index, 1);
    } else {
      permissions.push({ module, action });
    }
    
    setEditingRole({ ...editingRole, permissions });
  };

  const hasPermission = (module: string, action: string) => {
    return (editingRole?.permissions || []).some((p: any) => p.module === module && p.action === action);
  };

  // Toggle entire module row
  const toggleModuleRow = (module: string) => {
    const permissions = [...(editingRole?.permissions || [])];
    const allRowSelected = AVAILABLE_ACTIONS.every(action => hasPermission(module, action));

    let updated = permissions.filter(p => p.module !== module);
    if (!allRowSelected) {
      AVAILABLE_ACTIONS.forEach(action => {
        updated.push({ module, action });
      });
    }
    setEditingRole({ ...editingRole, permissions: updated });
  };

  // Toggle entire action column
  const toggleActionColumn = (action: string) => {
    const permissions = [...(editingRole?.permissions || [])];
    const allColSelected = AVAILABLE_MODULES.every(module => hasPermission(module, action));

    let updated = permissions.filter(p => p.action !== action);
    if (!allColSelected) {
      AVAILABLE_MODULES.forEach(module => {
        updated.push({ module, action });
      });
    }
    setEditingRole({ ...editingRole, permissions: updated });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setEditingRole({
      ...editingRole,
      name: editingRole.name || preset.name,
      description: editingRole.description || preset.description,
      permissions: [...preset.permissions]
    });
  };

  const filteredRoles = roles.filter(r => 
    r.name?.toLowerCase().includes(search.toLowerCase()) || 
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageShell>
      <PageHeader
        title="Roles & Permissions"
        description="Configure custom roles and fine-grained module access rights for store staff."
        actions={
          <Button onClick={() => setEditingRole({ name: "", description: "", permissions: [] })}>
            <Plus /> Create Custom Role
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <span>{error}</span>
        </Alert>
      )}

      {editingRole ? (
        /* Edit / Create Role Form Modal / Drawer */
        <Card className="overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-6 pt-6 flex justify-between items-center gap-3">
            <h2 className="text-tagline text-ink">
              {editingRole._id ? `Edit Role: ${editingRole.name}` : "Create New Custom Role"}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => setEditingRole(null)}
            >
              <X />
            </Button>
          </div>

          <form onSubmit={handleSaveRole} className="p-6 space-y-8">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role name *</Label>
                <Input
                  id="role-name"
                  type="text"
                  required
                  value={editingRole.name}
                  onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                  placeholder="e.g. Senior Pharmacist"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  type="text"
                  value={editingRole.description || ""}
                  onChange={e => setEditingRole({...editingRole, description: e.target.value})}
                  placeholder="Brief role summary..."
                />
              </div>
            </div>

            {/* Role Preset Quick Select */}
            <div className="space-y-3">
              <p className="text-body font-semibold text-ink">Apply a template preset</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Chip
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                  >
                    <span>{preset.name}</span>
                    <span className="text-ink-48 tabular">({preset.permissions.length} perms)</span>
                  </Chip>
                ))}
              </div>
            </div>

            {/* Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-body font-semibold text-ink">Permissions matrix</h3>
                <Badge variant="secondary" className="tabular">
                  {editingRole.permissions?.length || 0} Permissions Selected
                </Badge>
              </div>

              <div className="border border-hairline rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Module / entity</TableHead>
                      {AVAILABLE_ACTIONS.map(action => (
                        <TableHead key={action} className="text-center">
                          <button
                            type="button"
                            onClick={() => toggleActionColumn(action)}
                            className="press inline-flex items-center gap-1 text-caption font-semibold text-primary cursor-pointer"
                            title={`Select/Deselect all ${action} permissions`}
                          >
                            <span>{action}</span>
                            <CheckSquare className="size-3.5" aria-hidden="true" />
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Batch row</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {AVAILABLE_MODULES.map(module => {
                      const allRowSelected = AVAILABLE_ACTIONS.every(action => hasPermission(module, action));
                      return (
                        <TableRow key={module}>
                          <TableCell className="font-mono font-semibold">{module}</TableCell>
                          {AVAILABLE_ACTIONS.map(action => (
                            <TableCell key={`${module}-${action}`} className="text-center">
                              <input
                                type="checkbox"
                                aria-label={`${module} ${action}`}
                                className="accent-primary size-4 cursor-pointer align-middle"
                                checked={hasPermission(module, action)}
                                onChange={() => togglePermission(module, action)}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => toggleModuleRow(module)}
                              className="text-caption"
                            >
                              {allRowSelected ? "Deselect Row" : "Select Row"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRole(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? "Saving..." : "Save Role & Permissions"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        /* Roles List Table */
        <Card className="overflow-hidden flex flex-col">
          <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
              <Input
                type="text"
                aria-label="Search roles"
                placeholder="Search custom roles by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="tabular">
              Total roles: {roles.length}
            </Badge>
          </div>

          {loading ? (
            <div className="p-6 pt-0">
              <TableSkeleton columns={4} rows={4} />
            </div>
          ) : filteredRoles.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No custom roles found"
              description={search ? "Try adjusting your search terms." : "Create custom roles to assign granular access to your staff."}
              action={
                <Button onClick={() => setEditingRole({ name: "", description: "", permissions: [] })}>
                  Create First Role
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Assigned permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell className="font-semibold">{role.name}</TableCell>
                    <TableCell className="text-ink-48">{role.description || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="tabular">
                        {role.permissions?.length || 0} Allowed Rights
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRole(role)}
                        >
                          <Edit2 /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          className="text-destructive"
                        >
                          <Trash2 /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </PageShell>
  );
}
