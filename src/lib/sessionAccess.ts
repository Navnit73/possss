import { Db, ObjectId } from "mongodb";
import { isSubscriptionLapsed } from "./billing";

/** How long a session may keep its cached role/permissions/store state before it is re-read from the database. */
export const ACCESS_REFRESH_MS = 60 * 1000;

/** Everything a session caches about what its user is allowed to do. */
export async function resolveAccess(db: Db, user: Record<string, any>) {
  const [tenant, customRole] = await Promise.all([
    user.tenant_id ? db.collection("tenants").findOne({ _id: new ObjectId(String(user.tenant_id)) }) : null,
    user.role_id ? db.collection("roles").findOne({ _id: new ObjectId(String(user.role_id)) }) : null,
  ]);

  return {
    role: user.role,
    role_id: user.role_id ? String(user.role_id) : null,
    permissions: (customRole?.permissions ?? []) as { module: string; action: string }[],
    tenant_id: user.tenant_id ? String(user.tenant_id) : null,
    tenant_status: (tenant?.status ?? null) as string | null,
    subscription_lapsed: isSubscriptionLapsed(tenant?.subscription),
  };
}

/**
 * Re-validates a session token against the database when it is stale (or `force` is set).
 * Returns null when the session must end: the user was removed or their store was deleted.
 * Keeps the cached state on transient database errors so an outage doesn't sign everyone out.
 */
export async function refreshTokenAccess<T extends Record<string, any>>(token: T, db: Db, force = false): Promise<T | null> {
  const stale = force || Date.now() - Number(token.checkedAt || 0) > ACCESS_REFRESH_MS;
  if (!token.id || !stale) return token;

  try {
    const userDb = await db.collection("users").findOne(
      { _id: new ObjectId(token.id as string) },
      { projection: { role: 1, role_id: 1, tenant_id: 1 } }
    );
    if (!userDb) return null;

    const access = await resolveAccess(db, userDb);
    if (access.tenant_status === "DELETED") return null;

    Object.assign(token, access, { checkedAt: Date.now() });
  } catch (error) {
    console.error("Failed to refresh session access:", error);
  }
  return token;
}
