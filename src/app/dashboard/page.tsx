export default async function DashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
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
    </div>
  );
}
