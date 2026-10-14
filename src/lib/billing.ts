// Pure (no Node/DB imports) so it can be used from the proxy, the server and client components.

/** The one and only plan. Amount is in the smallest currency unit (cents). */
export const PLAN = {
  key: "pro",
  name: "Pro",
  amount: 4900,
  currency: "USD",
  interval: "monthly",
  /** Razorpay requires a bounded cycle count; 10 years of monthly charges. */
  totalCount: 120,
  features: [
    "Single store, unlimited products",
    "Advanced POS & inventory",
    "Reports, expiry & low-stock alerts",
    "Custom roles & staff accounts",
    "Priority support",
  ],
} as const;

export const PLAN_PRICE_LABEL = `$${PLAN.amount / 100}`;

export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

export interface TenantSubscription {
  id: string;
  plan_id?: string;
  status: SubscriptionStatus;
  current_start?: Date | string | null;
  current_end?: Date | string | null;
  charge_at?: Date | string | null;
  paid_count?: number;
  /** Set when the owner asked to stop renewing; access continues until current_end. */
  cancel_requested?: boolean;
}

/** Statuses that mean the customer has successfully authorised/paid. */
export const PAID_STATUSES: SubscriptionStatus[] = ["authenticated", "active"];

/**
 * Whether the store should be locked to the billing pages.
 * Tenants with no subscription record are legacy stores created before billing existed and are not locked;
 * new stores can't become ACTIVE without a verified subscription (see /api/account/subscription/verify).
 */
export function isSubscriptionLapsed(sub: Pick<TenantSubscription, "status" | "current_end"> | null | undefined, now = Date.now()): boolean {
  if (!sub) return false;
  switch (sub.status) {
    case "halted":
    case "expired":
    case "completed":
      return true;
    case "cancelled": {
      const end = sub.current_end ? new Date(sub.current_end).getTime() : 0;
      return end < now;
    }
    default:
      return false;
  }
}

/** Pages a locked store can still open so the owner can fix billing. */
export const LAPSED_ALLOWED_PREFIXES = [
  "/account/subscription",
  "/account/billing",
  "/account/profile",
  "/account/security",
];
