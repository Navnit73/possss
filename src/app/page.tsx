import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const tenantStatus = (session.user as any)?.tenant_status;
  const role = (session.user as any)?.role;

  if (tenantStatus && tenantStatus !== "ACTIVE") {
    redirect("/onboarding/create-store");
  }

  if (role === "CASHIER") {
    redirect("/pos/sell");
  }

  redirect("/dashboard");
}
