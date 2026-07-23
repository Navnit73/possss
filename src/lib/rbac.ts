import { Session } from "next-auth";
import { Role, Permission } from "./validations";
import { NextResponse } from "next/server";

export function checkRole(session: Session | null, allowedRoles: Role[]): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as Role;

  // OWNER overrides all role checks
  if (userRole === "OWNER") return null;

  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to perform this action" }, { status: 403 });
  }

  return null; // All good
}

export function checkPermission(session: Session | null, module: string, action: string): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as Role;

  // OWNER overrides all permission checks
  if (userRole === "OWNER") return null;

  const permissions = (session.user as any).permissions as Permission[] || [];
  
  const hasPermission = permissions.some(p => p.module === module && p.action === action);

  if (!hasPermission) {
    return NextResponse.json({ error: `Forbidden: Missing ${action} permission for ${module}` }, { status: 403 });
  }

  return null;
}

export function checkPermissionAny(
  session: Session | null,
  requiredPermissions: Array<{ module: string; action: string }>
): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as Role;

  // OWNER overrides all permission checks
  if (userRole === "OWNER") return null;

  const permissions = (session.user as any).permissions as Permission[] || [];

  const hasAny = requiredPermissions.some(req => 
    permissions.some(p => p.module === req.module && p.action === req.action)
  );

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
  return permissions.some(p => p.module === module && p.action === action);
}
