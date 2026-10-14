"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import Swal, { destructiveSwalClasses } from "@/lib/swal";
import { Users, Search, Trash2, Edit2, Shield, X, Eye, EyeOff, UserPlus } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

export default function UsersPage() {
  const { data: session } = useSession();
  const isOwnerViewer = (session?.user as any)?.role === "OWNER";
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role_id: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addError, setAddError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role_id: "" });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError("");
    // allSettled: a viewer with USERS:VIEW but no ROLES:VIEW must still see the staff list
    const [usersRes, rolesRes] = await Promise.allSettled([
      axios.get("/api/users"),
      axios.get("/api/roles")
    ]);
    if (usersRes.status === "fulfilled") setUsers(usersRes.value.data || []);
    else {
      console.error("Failed to fetch users", usersRes.reason);
      setLoadError((usersRes.reason as any)?.response?.data?.error || "Failed to load staff users. Please try again.");
    }

    if (rolesRes.status === "fulfilled") {
      const fetchedRoles = rolesRes.value.data || [];
      setRoles(fetchedRoles);
      setNewUser(prev => (!prev.role_id && fetchedRoles.length > 0 ? { ...prev, role_id: fetchedRoles[0]._id } : prev));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setAddError("");
    try {
      await axios.post("/api/users", { ...newUser, role: "CUSTOM" });
      setIsAddingUser(false);
      setNewUser({ name: "", email: "", password: "", role_id: roles.length > 0 ? roles[0]._id : "" });
      Swal.fire({
        title: 'User Created',
        text: 'New staff member added successfully.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
      fetchData();
    } catch (err: any) {
      setAddError(err.response?.data?.error || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      password: "",
      role_id: user.role_id || ""
    });
    setEditError("");
    setShowEditPassword(false);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || isUpdating) return;
    setIsUpdating(true);
    setEditError("");
    try {
      await axios.put(`/api/users/${editingUser._id}`, editForm);
      setEditingUser(null);
      Swal.fire({
        title: 'User Updated',
        text: 'Staff user account updated successfully.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
      fetchData();
    } catch (err: any) {
      setEditError(err.response?.data?.error || "Failed to update user");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    const confirm = await Swal.fire({
      title: `Delete ${user.name}?`,
      text: "This staff member will lose access to the system.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete User',
      customClass: destructiveSwalClasses
    });

    if (confirm.isConfirmed) {
      try {
        await axios.delete(`/api/users/${user._id}`);
        Swal.fire('Deleted!', 'User has been removed.', 'success');
        fetchData();
      } catch (err: any) {
        Swal.fire('Error', err.response?.data?.error || 'Failed to delete user', 'error');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
      u.email?.toLowerCase().includes(debouncedSearch.toLowerCase());
    
    const matchesRole = 
      roleFilter === "ALL" || 
      (roleFilter === "OWNER" && u.role === "OWNER") || 
      u.role_id === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleName = (user: any) => {
    if (user.role === "OWNER") return "Owner";
    if (user.role_id) {
      const role = roles.find(r => r._id === user.role_id);
      if (role) return role.name;
    }
    return user.role || "Staff";
  };

  return (
    <PageShell>
      <PageHeader
        title="Staff & Users"
        description="Manage system access, staff profiles, and custom role assignments for your store."
        actions={
          <Button
            onClick={() => { setIsAddingUser(!isAddingUser); setAddError(""); setShowNewPassword(false); }}
          >
            <UserPlus />
            {isAddingUser ? "Close Form" : "Add New User"}
          </Button>
        }
      />

      {/* Add User Drawer / Card */}
      {isAddingUser && (
        <Card className="p-6 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center gap-3 mb-6">
            <h2 className="text-tagline text-ink">Create Staff Account</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={() => setIsAddingUser(false)}>
              <X />
            </Button>
          </div>

          {addError && (
            <Alert variant="destructive" className="mb-5">
              {addError}
            </Alert>
          )}

          {roles.length === 0 ? (
            <Alert variant="warning">
              <p className="font-semibold">No custom roles found.</p>
              <p className="mt-0.5">Please create a staff role in Permissions before adding staff users.</p>
            </Alert>
          ) : (
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="new-user-name">Full name *</Label>
                <Input
                  id="new-user-name"
                  required
                  type="text"
                  placeholder="e.g. Dr. Alex Morgan"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email address *</Label>
                <Input
                  id="new-user-email"
                  required
                  type="email"
                  placeholder="alex@pharmacy.com"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Login password *</Label>
                <div className="relative">
                  <Input
                    id="new-user-password"
                    required
                    type={showNewPassword ? "text" : "password"}
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="press cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-ink-48"
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-role">Assigned role *</Label>
                <Select
                  id="new-user-role"
                  required
                  value={newUser.role_id}
                  onChange={e => setNewUser({...newUser, role_id: e.target.value})}
                >
                  {roles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingUser(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isSubmitting ? "Creating User..." : "Create Staff User"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Users Table Container */}
      <Card className="overflow-hidden flex flex-col">
        {/* Filters Header */}
        <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search staff"
              placeholder="Search staff by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-auto"
            >
              <option value="ALL">All Roles</option>
              <option value="OWNER">Store Owner</option>
              {roles.map(r => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </Select>

            <Badge variant="secondary" className="tabular">
              Total staff: {users.length}
            </Badge>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-6 pt-0">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : loadError ? (
          <div role="alert" className="p-10 text-center space-y-3">
            <p className="text-caption text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff members found"
            description={search || roleFilter !== "ALL" ? "Try adjusting your search terms or role filters." : "You haven't added any staff members yet."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Email address</TableHead>
                <TableHead>Role &amp; permissions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const isOwner = u.role === "OWNER";
                return (
                  <TableRow key={u._id}>
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-parchment text-ink text-caption font-semibold flex items-center justify-center shrink-0">
                          {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-ink-48">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={isOwner ? "dark" : "secondary"}>
                        <Shield />
                        {getRoleName(u)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-ink-48 tabular">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(!isOwner || isOwnerViewer) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(u)}
                          >
                            <Edit2 /> Edit
                          </Button>
                        )}
                        {!isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u)}
                            className="text-destructive"
                          >
                            <Trash2 /> Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => { if (!isUpdating) setEditingUser(null); }}
        title="Edit Staff Account"
        description="Update credentials and role assignment"
      >
        {editingUser && (
          <form onSubmit={handleEditUser} className="space-y-5">
            {editError && (
              <Alert variant="destructive">
                {editError}
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Full name *</Label>
              <Input
                id="edit-user-name"
                required
                type="text"
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email address *</Label>
              <Input
                id="edit-user-email"
                required
                type="email"
                value={editForm.email}
                onChange={e => setEditForm({...editForm, email: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="edit-user-password">Change password</Label>
                <span className="text-fine-print text-ink-48">Leave blank to keep current</span>
              </div>
              <div className="relative">
                <Input
                  id="edit-user-password"
                  type={showEditPassword ? "text" : "password"}
                  minLength={8}
                  placeholder="New password (optional)"
                  value={editForm.password}
                  onChange={e => setEditForm({...editForm, password: e.target.value})}
                  className="pr-12"
                />
                <button
                  type="button"
                  aria-label={showEditPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="press cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-ink-48"
                >
                  {showEditPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {editingUser.role !== "OWNER" && roles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Role &amp; permissions *</Label>
                <Select
                  id="edit-user-role"
                  required
                  value={editForm.role_id}
                  onChange={e => setEditForm({...editForm, role_id: e.target.value})}
                >
                  {!editForm.role_id && <option value="" disabled>Select a role</option>}
                  {roles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </PageShell>
  );
}
