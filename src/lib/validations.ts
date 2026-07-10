import { z } from "zod";

// --- Auth Validations ---

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

// --- Onboarding Validations (Tenants) ---

export const createStoreSchema = z.object({
  business_name: z.string().min(2, "Business name is required"),
});

export const businessDetailsSchema = z.object({
  country: z.string().min(2, "Country is required"),
  currency: z.string().min(3, "Currency code is required"),
  timezone: z.string().min(2, "Timezone is required"),
});

export const subscriptionSchema = z.object({
  subscription_plan: z.string().min(1, "Please select a plan"),
});

// --- Product Validations ---

export const categorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  description: z.string().optional(),
});

export const manufacturerSchema = z.object({
  name: z.string().min(2, "Manufacturer name is required"),
  contact_info: z.string().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2, "Medicine Name is required"),
  generic_name: z.string().transform(v => v === "" ? undefined : v).optional(),
  brand: z.string().transform(v => v === "" ? undefined : v).optional(),
  category_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Category"),
  manufacturer_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Manufacturer"),
  barcode: z.string().transform(v => v === "" ? undefined : v).optional(),
  sku: z.string().transform(v => v === "" ? undefined : v).optional(),
  strength: z.string().transform(v => v === "" ? undefined : v).optional(),
  dosage_form: z.string().transform(v => v === "" ? undefined : v).optional(),
  requires_prescription: z.boolean().default(false),
  minimum_stock: z.coerce.number().min(0).default(0),
  tax_rate: z.coerce.number().min(0).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

// --- DB Types ---

export type Role = "OWNER" | "MANAGER" | "PHARMACIST" | "CASHIER";

export interface User {
  _id?: any;
  tenant_id?: string;
  store_id?: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  resetToken?: string;
  resetTokenExpiry?: number;
  created_at: Date;
}

export interface Tenant {
  _id?: any;
  business_name: string;
  country?: string;
  currency?: string;
  timezone?: string;
  subscription_plan?: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  created_at: Date;
}

export interface Category {
  _id?: any;
  tenant_id: string;
  name: string;
  description?: string;
  created_at: Date;
}

export interface Manufacturer {
  _id?: any;
  tenant_id: string;
  name: string;
  contact_info?: string;
  created_at: Date;
}

export interface Product {
  _id?: any;
  tenant_id: string;
  name: string;
  generic_name?: string;
  brand?: string;
  barcode?: string;
  sku?: string;
  category_id: string;
  manufacturer_id: string;
  strength?: string;
  dosage_form?: string;
  requires_prescription: boolean;
  minimum_stock: number;
  tax_rate: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: Date;
}
