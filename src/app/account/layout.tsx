import { AlertCircle } from "lucide-react";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { Header } from "@/components/dashboard/Header";

import { auth } from "@/auth";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <div className="flex">
        <AccountSidebar session={session} />
        <div className="flex-1 min-w-0">
          {(session?.user as any)?.subscription_lapsed && (
            <div role="status" className="flex items-start gap-3 px-6 py-3 bg-canvas border-b border-hairline text-caption text-ink">
              <AlertCircle className="size-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
              <p>
                This store&apos;s subscription is inactive, so most features are locked.{" "}
                {(session?.user as any)?.role === "OWNER"
                  ? "Renew it under Subscription to restore access."
                  : "Please ask the store owner to renew it."}
              </p>
            </div>
          )}
          <main>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
