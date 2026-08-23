import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().url("MONGODB_URI must be a valid URL"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  RESEND_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";

const _env = envSchema.safeParse(process.env);

let parsedEnv: z.infer<typeof envSchema>;

if (!_env.success) {
  if (isBuildPhase || process.env.NODE_ENV === "test") {
    console.warn("⚠️ Warning: Building without full environment variables configured. Using build fallbacks.");
    parsedEnv = {
      MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://build-mock-user:build-mock-pass@cluster0.example.mongodb.net/pos?retryWrites=true&w=majority",
      AUTH_SECRET: process.env.AUTH_SECRET || "build-time-secret-placeholder-for-compilation-at-least-32-chars",
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
      NODE_ENV: (process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development"),
    };
  } else {
    console.error("❌ Invalid environment variables:", _env.error.format());
    throw new Error("Invalid environment variables. Please check your .env configuration.");
  }
} else {
  parsedEnv = _env.data;
}

export const env = parsedEnv;

