"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Plus, Users, Search, Trash2, Edit2, Shield, X, CheckCircle2, Lock } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role_id: "" });
  const [addError, setAddError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role_id: "" });
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axios.get("/api/users"),
        axios.get("/api/roles")
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      if (rolesRes.data.length > 0) {
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

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleName = (user: any) => {
    if (user.role === "OWNER") return "Owner";
    if (user.role_id) {
      const role = roles.find(r => r._id === user.role_id);
      if (role) return role.name;
    }
    return user.role;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <PageHeader 
        title="Staff & Users"
        description="Manage system access, user details, and roles for your pharmacy staff."
        actions={
          <button
            onClick={() => { setIsAddingUser(!isAddingUser); setAddError(""); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all text-xs font-extrabold shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isAddingUser ? "Cancel" : "Add New User"}
          </button>
        }
      />

      {/* Add User Form Drawer */}
      {isAddingUser && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" /> Add New Staff User
            </h3>
            <button onClick={() => setIsAddingUser(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {addError && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
              {addError}
            </div>
          )}

          {roles.length === 0 ? (
            <div className="mb-4 p-4 border border-amber-200 bg-amber-50/80 rounded-xl text-xs flex gap-3 items-center text-amber-900">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">No custom roles found.</p>
                <p className="text-amber-800 mt-0.5">Please create a staff role in Permissions before adding users.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Dr. Alex Morgan"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address *</label>
                <input 
                  required
                  type="email" 
                  placeholder="alex@pharmacy.com"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Login Password *</label>
                <input 
                  required
                  type="password" 
                  minLength={8}
                  placeholder="Min 8 characters"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Assigned Staff Role *</label>
                <select 
                  required
                  value={newUser.role_id}
                  onChange={e => setNewUser({...newUser, role_id: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold transition-all"
                >
                  {roles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl transition-all text-xs font-extrabold disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isSubmitting ? "Creating User..." : "Create Staff User"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Users Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
            <input 
              type="text" 
              placeholder="Search staff by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
            />
          </div>
          <div className="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
            Total Staff: {users.length}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 shadow-2xs">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 mb-1">No staff members found</h3>
            <p className="text-slate-500 text-xs max-w-sm">
              {search ? "Try adjusting your search terms." : "You haven't added any staff members yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70">
                  <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Email Address</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Role & Permissions</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredUsers.map((u) => {
                  const isOwner = u.role === "OWNER";
                  return (
                    <tr key={u._id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isOwner 
                            ? "bg-amber-100 text-amber-900 border-amber-300" 
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}>
                          <Shield className="w-3 h-3" />
                          {getRoleName(u)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                            title="Edit User Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {!isOwner && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-all cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-none">Edit Staff User</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Update user credentials & role assignment</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingUser(null)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
                  {editError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input 
                  required
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address *</label>
                <input 
                  required
                  type="email" 
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Change Password</span>
                  <span className="text-[10px] font-normal text-slate-400">Leave blank to keep current</span>
                </label>
                <input 
                  type="password" 
                  minLength={8}
                  placeholder="New password (optional)"
                  value={editForm.password}
                  onChange={e => setEditForm({...editForm, password: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium transition-all"
                />
              </div>

              {editingUser.role !== "OWNER" && roles.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Role & Permissions *</label>
                  <select 
                    required
                    value={editForm.role_id}
                    onChange={e => setEditForm({...editForm, role_id: e.target.value})}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold transition-all"
                  >
                    {roles.map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl transition-all text-xs font-extrabold disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isUpdating ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
