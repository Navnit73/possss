import { auth, signOut } from "@/auth";
import { Activity, LogOut } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="w-6 h-6" />
          <span className="font-display font-bold text-lg">Pharmacy POS Dashboard</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-sm">
            <p className="font-medium text-foreground">{session?.user?.name}</p>
            <p className="text-muted-foreground capitalize">{(session?.user as any)?.role?.toLowerCase()}</p>
          </div>
          
          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button type="submit" className="text-muted-foreground hover:text-red-500 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>
      
      <main className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8 text-foreground">Overview</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border p-6 rounded-lg">
            <p className="text-sm text-muted-foreground font-medium mb-2">Total Sales Today</p>
            <p className="text-3xl font-display font-bold text-foreground">$0.00</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-lg">
            <p className="text-sm text-muted-foreground font-medium mb-2">Inventory Alerts</p>
            <p className="text-3xl font-display font-bold text-warning">0 items</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-lg">
            <p className="text-sm text-muted-foreground font-medium mb-2">Active Prescriptions</p>
            <p className="text-3xl font-display font-bold text-foreground">0</p>
          </div>
        </div>
      </main>
    </div>
  );
}
