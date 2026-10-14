import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";

import { auth } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} withMobileMenu />
      <div className="flex">
        <Sidebar session={session} />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
