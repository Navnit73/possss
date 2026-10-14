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
    <div className="flex min-h-screen bg-background">
      <AccountSidebar session={session} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header session={session} />
        {(session?.user as any)?.subscription_lapsed && (
          <div className="px-6 py-3 text-sm bg-red-500/10 border-b border-red-500/20 text-red-600">
            This store&apos;s subscription is inactive, so most features are locked.{" "}
            {(session?.user as any)?.role === "OWNER"
              ? "Renew it under Subscription to restore access."
              : "Please ask the store owner to renew it."}
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
