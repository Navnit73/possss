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
 * `auth()` in route handlers and server components can't write the refreshed token back to the cookie,
 * so a stale token would otherwise hit the database on every call (twice for audited routes).
 * Recent lookups are shared per process for a few seconds; null means the session must end.
 */
const ACCESS_MEMO_MS = 10 * 1000;
const accessMemo = new Map<string, { at: number; access: Awaited<ReturnType<typeof resolveAccess>> | null; passwordChangedAt: number }>();

/** A password change (reset, self-change or admin change) ends sessions that signed in before it. Tokens without authAt predate this check. */
function isRevokedByPasswordChange(token: Record<string, any>, passwordChangedAt: number): boolean {
  return passwordChangedAt > 0 && Number(token.authAt) > 0 && passwordChangedAt > Number(token.authAt);
}

/**
 * Re-validates a session token against the database when it is stale (or `force` is set).
 * Returns null when the session must end: the user was removed or their store was deleted.
 * Keeps the cached state on transient database errors so an outage doesn't sign everyone out.
 */
export async function refreshTokenAccess<T extends Record<string, any>>(token: T, db: Db, force = false): Promise<T | null> {
  const stale = force || Date.now() - Number(token.checkedAt || 0) > ACCESS_REFRESH_MS;
  if (!token.id || !stale) return token;

  const userId = String(token.id);
  const memo = accessMemo.get(userId);
  if (!force && memo && Date.now() - memo.at < ACCESS_MEMO_MS) {
    if (!memo.access || isRevokedByPasswordChange(token, memo.passwordChangedAt)) return null;
    return Object.assign(token, memo.access, { checkedAt: memo.at });
  }

  try {
    const userDb = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { role: 1, role_id: 1, tenant_id: 1, password_changed_at: 1 } }
    );
    const access = userDb ? await resolveAccess(db, userDb) : null;
    const valid = access && access.tenant_status !== "DELETED" ? access : null;

    const now = Date.now();
    if (accessMemo.size > 5000) accessMemo.clear();
    accessMemo.set(userId, { at: now, access: valid, passwordChangedAt: userDb?.password_changed_at ? new Date(userDb.password_changed_at).getTime() : 0 });
    if (!valid || isRevokedByPasswordChange(token, accessMemo.get(userId)!.passwordChangedAt)) return null;

    Object.assign(token, valid, { checkedAt: now });
  } catch (error) {
    console.error("Failed to refresh session access:", error);
  }
  return token;
}
