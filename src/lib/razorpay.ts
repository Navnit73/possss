import crypto from "crypto";
import Razorpay from "razorpay";
import client from "./mongodb";
import { env } from "./env";
import { PLAN } from "./billing";

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Billing is not configured yet. Please contact support.");
    this.name = "BillingNotConfiguredError";
  }
}

const globalForRazorpay = global as typeof globalThis & { _razorpay?: Razorpay };

export function isBillingConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new BillingNotConfiguredError();
  if (!globalForRazorpay._razorpay) {
    globalForRazorpay._razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return globalForRazorpay._razorpay;
}

export function getPublicKeyId(): string {
  if (!env.RAZORPAY_KEY_ID) throw new BillingNotConfiguredError();
  return env.RAZORPAY_KEY_ID;
}

const PLAN_CONFIG_ID = `razorpay_plan_${PLAN.key}_${PLAN.currency.toLowerCase()}_${PLAN.amount}`;

/** The $49/month plan: RAZORPAY_PLAN_ID if set, otherwise created once and remembered in MongoDB. */
export async function getPlanId(): Promise<string> {
  if (env.RAZORPAY_PLAN_ID) return env.RAZORPAY_PLAN_ID;

  const configs = client.db("pos").collection<{ _id: string; plan_id: string }>("app_config");
  const saved = await configs.findOne({ _id: PLAN_CONFIG_ID });
  if (saved?.plan_id) return saved.plan_id;

  const plan = await getRazorpay().plans.create({
    period: PLAN.interval,
    interval: 1,
    item: {
      name: `Medishelf POS ${PLAN.name}`,
      description: "Medishelf POS monthly subscription",
      amount: PLAN.amount,
      currency: PLAN.currency,
    },
    notes: { plan_key: PLAN.key },
  });

  // Two first-time requests can race; the unique _id makes exactly one plan win.
  try {
    await configs.insertOne({ _id: PLAN_CONFIG_ID, plan_id: plan.id });
    return plan.id;
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
    return (await configs.findOne({ _id: PLAN_CONFIG_ID }))?.plan_id ?? plan.id;
  }
}

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verifies the signature Razorpay Checkout hands the browser after a successful subscription payment. */
export function verifyCheckoutSignature(paymentId: string, subscriptionId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

/** Verifies an incoming webhook against the *raw* request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
