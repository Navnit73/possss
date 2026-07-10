import { Session } from "next-auth";
import { Role } from "./validations";
import { NextResponse } from "next/server";

export function checkRole(session: Session | null, allowedRoles: Role[]): NextResponse | null {
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as Role;

  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to perform this action" }, { status: 403 });
  }

  return null; // All good
}
