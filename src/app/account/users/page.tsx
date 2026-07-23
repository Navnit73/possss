"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Plus, Users, Search, Trash2, Edit2, Shield, X, Eye, EyeOff, UserPlus, Filter, RefreshCw, CheckCircle2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Button } from "@/components/ui/Button";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axios.get("/api/users"),
        axios.get("/api/roles")
      ]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
      if (rolesRes.data.length > 0 && !newUser.role_id) {
        setNewUser(prev => ({ ...prev, role_id: rolesRes.data[0]._id }));
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
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
      role_id: user.role_id || (roles.length > 0 ? roles[0]._id : "")
    });
    setEditError("");
    setShowEditPassword(false);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
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
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete User'
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Users className="w-4 h-4" /> Team Management
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff & Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage system access, staff profiles, and custom role assignments for your store.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => { setIsAddingUser(!isAddingUser); setAddError(""); setShowNewPassword(false); }}
            className="gap-2 text-xs font-semibold"
          >
            <UserPlus className="w-4 h-4" />
            {isAddingUser ? "Close Form" : "Add New User"}
          </Button>
        </div>
      </div>

      {/* Add User Drawer / Card */}
      {isAddingUser && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Create Staff Account
            </h3>
            <button onClick={() => setIsAddingUser(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {addError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-xs font-semibold">
              {addError}
            </div>
          )}

          {roles.length === 0 ? (
            <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg text-xs flex gap-3 items-center text-amber-700">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">No custom roles found.</p>
                <p className="mt-0.5">Please create a staff role in Permissions before adding staff users.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Dr. Alex Morgan"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full h-10 px-3.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address *</label>
                <input 
                  required
                  type="email" 
                  placeholder="alex@pharmacy.com"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full h-10 px-3.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Login Password *</label>
                <div className="relative">
                  <input 
                    required
                    type={showNewPassword ? "text" : "password"}
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full h-10 pl-3 pr-10 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned Role *</label>
                <select 
                  required
                  value={newUser.role_id}
                  onChange={e => setNewUser({...newUser, role_id: e.target.value})}
                  className="w-full h-10 px-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-semibold text-foreground"
                >
                  {roles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingUser(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="font-semibold gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Creating User..." : "Create Staff User"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Users Table Container */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col shadow-2xs">
        {/* Filters Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search staff by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-medium transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 border border-border rounded-md bg-background text-foreground text-xs font-semibold"
            >
              <option value="ALL">All Roles</option>
              <option value="OWNER">Store Owner</option>
              {roles.map(r => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>

            <div className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 whitespace-nowrap">
              Total Staff: {users.length}
            </div>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <Users className="w-7 h-7 opacity-40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No staff members found</h3>
            <p className="text-muted-foreground text-xs max-w-sm">
              {search || roleFilter !== "ALL" ? "Try adjusting your search terms or role filters." : "You haven't added any staff members yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-5 py-3">Staff Member</th>
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Role & Permissions</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredUsers.map((u) => {
                  const isOwner = u.role === "OWNER";
                  return (
                    <tr key={u._id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          isOwner 
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                            : "bg-primary/10 text-primary border border-primary/20"
                        }`}>
                          <Shield className="w-3 h-3" />
                          {getRoleName(u)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono">
                        {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(u)}
                            className="h-8 px-2.5 text-xs font-medium"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          {!isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u)}
                              className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base leading-none">Edit Staff Account</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Update credentials and role assignment</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingUser(null)} 
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-xs font-semibold">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</label>
                <input 
                  required
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full h-10 px-3.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address *</label>
                <input 
                  required
                  type="email" 
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                  className="w-full h-10 px-3.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Change Password</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Leave blank to keep current</span>
                </label>
                <div className="relative">
                  <input 
                    type={showEditPassword ? "text" : "password"}
                    minLength={8}
                    placeholder="New password (optional)"
                    value={editForm.password}
                    onChange={e => setEditForm({...editForm, password: e.target.value})}
                    className="w-full h-10 pl-3 pr-10 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {editingUser.role !== "OWNER" && roles.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role & Permissions *</label>
                  <select 
                    required
                    value={editForm.role_id}
                    onChange={e => setEditForm({...editForm, role_id: e.target.value})}
                    className="w-full h-10 px-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-semibold text-foreground"
                  >
                    {roles.map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="font-semibold gap-2"
                >
                  {isUpdating && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

