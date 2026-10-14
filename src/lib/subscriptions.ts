import { Db, ObjectId } from "mongodb";
import { PAID_STATUSES, PLAN, SubscriptionStatus, TenantSubscription } from "./billing";

/** The subset of Razorpay's subscription entity we rely on (timestamps are unix seconds). */
export interface RazorpaySubscriptionEntity {
  id: string;
  plan_id?: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  paid_count?: number;
  notes?: Record<string, unknown> | unknown[] | null;
}

export interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  invoice_id?: string | null;
  created_at?: number;
}

const KNOWN_STATUSES: SubscriptionStatus[] = [
  "created", "authenticated", "active", "pending", "halted", "cancelled", "completed", "expired", "paused",
];

const fromUnix = (seconds?: number | null) => (seconds ? new Date(seconds * 1000) : null);

export interface ApplyResult {
  tenantId: string | null;
  /** True when this subscription is now the store's live subscription. */
  applied: boolean;
  status: SubscriptionStatus | null;
}

/**
 * Writes the state of one Razorpay subscription onto its tenant.
 * - A subscription the owner just paid for (the "checkout") is promoted to the store's subscription once Razorpay reports it authenticated/active,
 *   which is also what moves a brand-new store from PENDING to ACTIVE.
 * - Updates for the current subscription are mirrored as-is.
 * - Anything else (an abandoned or superseded subscription) is ignored.
 */
export async function applySubscriptionEntity(db: Db, entity: RazorpaySubscriptionEntity): Promise<ApplyResult> {
  const tenants = db.collection("tenants");

  const tenant = await tenants.findOne({ $or: [{ "subscription.id": entity.id }, { "subscription_checkout.id": entity.id }] });
  if (!tenant) return { tenantId: null, applied: false, status: null };

  const status = (KNOWN_STATUSES as string[]).includes(entity.status) ? (entity.status as SubscriptionStatus) : null;
  if (!status) return { tenantId: tenant._id.toString(), applied: false, status: null };

  const isCurrent = tenant.subscription?.id === entity.id;
  const isCheckout = tenant.subscription_checkout?.id === entity.id;

  const next: TenantSubscription & { updated_at: Date } = {
    id: entity.id,
    plan_id: entity.plan_id ?? tenant.subscription?.plan_id,
    status,
    current_start: fromUnix(entity.current_start),
    current_end: fromUnix(entity.current_end),
    charge_at: fromUnix(entity.charge_at),
    paid_count: entity.paid_count ?? 0,
    // A pending "cancel at cycle end" survives until Razorpay actually cancels; a paused/resumed state clears it only via resume.
    cancel_requested: isCurrent ? Boolean(tenant.subscription?.cancel_requested) && status !== "cancelled" : false,
    updated_at: new Date(),
  };

  if (isCurrent) {
    await tenants.updateOne({ _id: tenant._id }, { $set: { subscription: next, updated_at: new Date() } });
    return { tenantId: tenant._id.toString(), applied: true, status };
  }

  if (isCheckout && PAID_STATUSES.includes(status)) {
    const $set: Record<string, unknown> = { subscription: next, updated_at: new Date() };
    // Only a store that is still being onboarded becomes ACTIVE here; suspended/deleted stores stay as they are.
    if (tenant.status === "PENDING") $set.status = "ACTIVE";
    await tenants.updateOne({ _id: tenant._id }, { $set, $unset: { subscription_checkout: "" } });
    return { tenantId: tenant._id.toString(), applied: true, status };
  }

  return { tenantId: tenant._id.toString(), applied: false, status };
}

/** Records a successful charge once, no matter how many times Razorpay retries the webhook. */
export async function recordPayment(db: Db, tenantId: string, subscriptionId: string, payment: RazorpayPaymentEntity) {
  await db.collection("payments").updateOne(
    { razorpay_payment_id: payment.id },
    {
      $set: {
        status: payment.status,
        method: payment.method ?? null,
        invoice_id: payment.invoice_id ?? null,
      },
      $setOnInsert: {
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        plan_name: PLAN.name,
        amount: payment.amount / 100,
        currency: payment.currency,
        created_at: fromUnix(payment.created_at) ?? new Date(),
      },
    },
    { upsert: true }
  );
}

export function tenantObjectId(id: unknown): ObjectId | null {
  return typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null;
}
