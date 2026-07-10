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
  // Basic Information
  name: z.string().min(2, "Medicine Name is required"),
  generic_name: z.string().transform(v => v === "" ? undefined : v).optional(),
  brand: z.string().transform(v => v === "" ? undefined : v).optional(),
  category_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Category"),
  manufacturer_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Manufacturer"),
  barcode: z.string().transform(v => v === "" ? undefined : v).optional(),
  sku: z.string().transform(v => v === "" ? undefined : v).optional(),
  
  // Regulatory & Compliance
  schedule_class: z.string().transform(v => v === "" ? undefined : v).optional(),
  hsn_code: z.string().transform(v => v === "" ? undefined : v).optional(),
  ndc_code: z.string().transform(v => v === "" ? undefined : v).optional(),
  
  // Clinical & Administration
  strength: z.string().transform(v => v === "" ? undefined : v).optional(),
  dosage_form: z.string().transform(v => v === "" ? undefined : v).optional(),
  route_of_administration: z.string().transform(v => v === "" ? undefined : v).optional(),
  active_ingredients: z.string().transform(v => v === "" ? undefined : v).optional(),
  storage_conditions: z.string().transform(v => v === "" ? undefined : v).optional(),
  pregnancy_category: z.string().transform(v => v === "" ? undefined : v).optional(),
  requires_prescription: z.boolean().default(false),
  
  // Packaging & Dispensing
  unit_of_measure: z.string().min(1, "Unit of Measure is required"),
  package_type: z.string().transform(v => v === "" ? undefined : v).optional(),
  package_size: z.coerce.number().min(1).default(1),
  
  // Inventory Settings
  rack_number: z.string().transform(v => v === "" ? undefined : v).optional(),
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
  
  schedule_class?: string;
  hsn_code?: string;
  ndc_code?: string;
  
  strength?: string;
  dosage_form?: string;
  route_of_administration?: string;
  active_ingredients?: string;
  storage_conditions?: string;
  pregnancy_category?: string;
  requires_prescription: boolean;
  
  unit_of_measure: string;
  package_type?: string;
  package_size: number;
  
  rack_number?: string;
  minimum_stock: number;
  tax_rate: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: Date;
  updated_at?: Date;
}

// --- Inventory Validations ---

export const batchSchema = z.object({
  product_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Product"),
  batch_number: z.string().min(1, "Batch number is required"),
  supplier: z.string().optional(),
  qty_available: z.coerce.number().min(0, "Quantity cannot be negative").default(0),
  cost_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  expiry_date: z.string().optional(),
  rack_location: z.string().optional(),
});

export const stockMovementSchema = z.object({
  product_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Product"),
  batch_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Batch"),
  movement_type: z.enum(["PURCHASE", "SALE", "DAMAGE", "RETURN", "ADJUSTMENT"]),
  quantity: z.coerce.number(), // can be negative
  notes: z.string().optional(),
});

export interface Batch {
  _id?: any;
  tenant_id: string;
  product_id: string;
  batch_number: string;
  supplier?: string;
  qty_available: number;
  cost_price: number;
  selling_price: number;
  expiry_date?: string;
  rack_location?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface StockMovement {
  _id?: any;
  tenant_id: string;
  product_id: string;
  batch_id: string;
  movement_type: "PURCHASE" | "SALE" | "DAMAGE" | "RETURN" | "ADJUSTMENT";
  quantity: number;
  before_qty: number;
  after_qty: number;
  notes?: string;
  created_by?: string;
  created_at: Date;
}

