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
