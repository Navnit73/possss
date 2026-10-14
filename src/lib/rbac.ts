import { Session } from "next-auth";
import { Role, Permission } from "./validations";
import { NextResponse } from "next/server";

interface GuardOptions {
  /** Billing/subscription endpoints must stay reachable when the store's subscription has lapsed. */
  allowLapsed?: boolean;
}

function subscriptionLockedResponse(session: Session | null, options?: GuardOptions): NextResponse | null {
  if (!options?.allowLapsed && (session?.user as any)?.subscription_lapsed) {
    return NextResponse.json(
      { error: "Your subscription is inactive. The store owner needs to renew it under Account → Subscription." },
      { status: 402 }
    );
  }
  return null;
}

export function checkRole(session: Session | null, allowedRoles: Role[], options?: GuardOptions): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locked = subscriptionLockedResponse(session, options);
  if (locked) return locked;

  const userRole = (session.user as any).role as Role;

  // OWNER overrides all role checks
  if (userRole === "OWNER") return null;

  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to perform this action" }, { status: 403 });
  }

  return null; // All good
}

function getEquivalentActions(action: string): string[] {
  const upper = action.toUpperCase();
  if (upper === "UPDATE" || upper === "EDIT") return ["UPDATE", "EDIT"];
  if (upper === "VIEW" || upper === "READ") return ["VIEW", "READ"];
  if (upper === "CREATE" || upper === "ADD") return ["CREATE", "ADD"];
  return [upper];
}

export function checkPermission(session: Session | null, module: string, action: string, options?: GuardOptions): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locked = subscriptionLockedResponse(session, options);
  if (locked) return locked;

  const userRole = (session.user as any).role as Role;

  // OWNER overrides all permission checks
  if (userRole === "OWNER") return null;

  const permissions = (session.user as any).permissions as Permission[] || [];
  const acceptedActions = getEquivalentActions(action);
  const hasPermission = permissions.some(p => p.module === module && acceptedActions.includes(p.action.toUpperCase()));

  if (!hasPermission) {
    return NextResponse.json({ error: `Forbidden: Missing ${action} permission for ${module}` }, { status: 403 });
  }

  return null;
}

export function checkPermissionAny(
  session: Session | null,
  requiredPermissions: Array<{ module: string; action: string }>,
  options?: GuardOptions
): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locked = subscriptionLockedResponse(session, options);
  if (locked) return locked;

  const userRole = (session.user as any).role as Role;

  // OWNER overrides all permission checks
  if (userRole === "OWNER") return null;

  const permissions = (session.user as any).permissions as Permission[] || [];

  const hasAny = requiredPermissions.some(req => {
    const acceptedActions = getEquivalentActions(req.action);
    return permissions.some(p => p.module === req.module && acceptedActions.includes(p.action.toUpperCase()));
  });

  if (!hasAny) {
    const permString = requiredPermissions.map(r => `${r.module}:${r.action}`).join(" or ");
    return NextResponse.json({ error: `Forbidden: Missing permission (${permString})` }, { status: 403 });
  }

  return null;
}

export function hasPermissionSync(session: Session | null, module: string, action: string): boolean {
  if (!session || !session.user) return false;
  
  const userRole = (session.user as any).role as Role;
  if (userRole === "OWNER") return true;

  const permissions = (session.user as any).permissions as Permission[] || [];
  const acceptedActions = getEquivalentActions(action);
  return permissions.some(p => p.module === module && acceptedActions.includes(p.action.toUpperCase()));
}

/** True when the user already holds every one of these permissions (owners hold everything). */
export function canGrantPermissions(session: Session | null, permissions: Array<{ module: string; action: string }>): boolean {
  return permissions.every((p) => hasPermissionSync(session, p.module, p.action));
}
