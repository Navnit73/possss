import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().url("MONGODB_URI must be a valid URL"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  RESEND_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables");
}

export const env = _env.data;
