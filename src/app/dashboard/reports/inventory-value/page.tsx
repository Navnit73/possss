"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import axios from "axios";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Filter, Loader2 } from "lucide-react";
import Papa from "papaparse";

export default function InventoryValueReportPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);

  // Draft Filters state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  // Active Filters state
  const [activeFilters, setActiveFilters] = useState({
    search: "",
    category: ""
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    product_name: true,
    category: true,
    batch_number: true,
    rack_location: true,
    qty_available: true,
    cost_price: true,
    selling_price: true,
    total_cost_value: true,
    expiry_date: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  useEffect(() => {
    // Fetch categories list for dropdown
    axios.get("/api/categories")
      .then(res => setCategories(res.data))
      .catch(err => console.error("Failed to load categories", err));
  }, []);

  const fetchReport = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        search: activeFilters.search,
        category: activeFilters.category,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/reports/inventory-value", { params });
      
      if (exportMode) {
        exportToCSV(res.data.table.data);
      } else {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch report", err);
      Swal.fire('Error', String("Failed to load report data"), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeFilters, page, limit]); 

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setActiveFilters({
      search,
      category
    });
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Product": item.product_name,
      "Category": item.category,
      "Batch": item.batch_number,
      "Rack": item.rack_location,
      "Qty Available": item.qty_available,
      "Cost Price": item.cost_price,
      "Selling Price": item.selling_price,
      "Total Cost Value": item.total_cost_value,
      "Expected Revenue": item.expected_revenue,
      "Expiry Date": item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Inventory_Value_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const CATEGORY_COLORS = ['#f59e0b', '#0284c7', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];

  return (
    <div className="space-y-8 relative min-h-[600px]">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 sticky top-0 z-20">
        <form onSubmit={handleApplyFilter} className="flex flex-col gap-4">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Filter Inputs Group */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Category Filter */}
              <div className="relative min-w-[180px]">
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-3 pr-8 py-2 border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 rounded disabled:opacity-60"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat: any) => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <input 
                  type="text" 
                  placeholder="Search Product or Batch..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-zinc-200 text-sm bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder:text-zinc-400 rounded disabled:opacity-60"
                />
              </div>

              {/* Apply Filter Button */}
              <button 
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:bg-amber-400 transition-colors rounded shadow-xs cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying Filters...
                  </>
                ) : (
                  <>
                    <Filter className="w-4 h-4" />
                    Apply Filter
                  </>
                )}
              </button>

            </div>

            {/* Export Action */}
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => fetchReport(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white font-semibold text-sm hover:bg-zinc-900 disabled:opacity-60 transition-colors rounded shadow-xs"
              >
                Export CSV
              </button>
            </div>

          </div>
        </form>
      </div>

      {/* Loading Overlay Backdrop Screen */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
      
        </div>
      )}

      {/* Report Content */}
      {data && (
        <>
          {/* Key Metrics - Ledger Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Unique Products</p>
              <h3 className="text-3xl font-mono text-zinc-900 font-bold">{data.metrics.total_products}</h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Total Stock Qty</p>
              <h3 className="text-3xl font-mono text-zinc-900 font-bold">{data.metrics.total_stock_qty}</h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Inventory Value (Cost)</p>
              <h3 className="text-3xl font-mono text-amber-600 font-bold">${data.metrics.purchase_value.toFixed(2)}</h3>
            </div>
            <div className="p-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Expected Profit</p>
              <h3 className="text-3xl font-mono text-emerald-600 font-bold">${data.metrics.expected_profit.toFixed(2)}</h3>
            </div>
          </div>

          {/* Row 1 Charts: Category Inventory Valuation & Top Valued Products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Chart 1: Inventory Cost Value Share by Category */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">1. Stock Valuation Share by Category</h3>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.categoryValue}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="cost_value"
                      nameKey="name"
                    >
                      {data.charts.categoryValue.map((entry: any, index: number) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: any) => `$${Number(val).toFixed(2)}`} contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontFamily: 'monospace'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Cost Value vs Expected Retail Revenue Comparison */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">2. Cost Value vs Expected Retail Revenue ($)</h3>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Purchase Cost</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Retail Revenue</span>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.categoryValue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 11, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Bar dataKey="cost_value" name="Purchase Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="selling_value" name="Retail Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Row 2 Charts: Top 5 Valued Products & Rack Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Chart 3: Top 5 Highest Stock Valuation Products */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">3. Top 5 Highest Stock Value Medicines</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.topValuedProducts} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                    <XAxis type="number" tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 10, fill: '#3f3f46', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Bar dataKey="value" name="Total Stock Value" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Stock Distribution by Rack Location */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">4. Stock Quantity by Rack Location</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.rackDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="rack" tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Bar dataKey="qty" name="Stock Qty" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Data Table */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Current Stock Valuation</h3>
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors rounded"
                >
                  Columns
                </button>
                {showColumnSettings && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-xl z-20 p-2 text-sm">
                    {Object.keys(visibleColumns).map((col) => (
                      <label key={col} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 cursor-pointer capitalize">
                        <input 
                          type="checkbox" 
                          checked={visibleColumns[col as keyof typeof visibleColumns]} 
                          onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                          className="text-amber-600 focus:ring-amber-500 border-zinc-300"
                        />
                        {col.replace(/_/g, ' ')}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-white border-b border-zinc-200 text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                    {visibleColumns.product_name && <th className="px-6 py-4">Product</th>}
                    {visibleColumns.category && <th className="px-6 py-4">Category</th>}
                    {visibleColumns.batch_number && <th className="px-6 py-4">Batch</th>}
                    {visibleColumns.rack_location && <th className="px-6 py-4">Rack</th>}
                    {visibleColumns.qty_available && <th className="px-6 py-4 text-right">Available Qty</th>}
                    {visibleColumns.cost_price && <th className="px-6 py-4 text-right">Cost Price</th>}
                    {visibleColumns.selling_price && <th className="px-6 py-4 text-right">Selling Price</th>}
                    {visibleColumns.total_cost_value && <th className="px-6 py-4 text-right">Total Cost Val</th>}
                    {visibleColumns.expiry_date && <th className="px-6 py-4">Expiry Date</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-zinc-500 font-mono">
                        No active stock found for selected filters.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-zinc-50 transition-colors">
                        {visibleColumns.product_name && <td className="px-6 py-4 font-medium text-zinc-900">{row.product_name}</td>}
                        {visibleColumns.category && <td className="px-6 py-4 text-zinc-500 font-mono text-xs">{row.category}</td>}
                        {visibleColumns.batch_number && <td className="px-6 py-4 font-mono text-xs text-zinc-500">{row.batch_number}</td>}
                        {visibleColumns.rack_location && <td className="px-6 py-4 text-zinc-600 font-mono">{row.rack_location}</td>}
                        {visibleColumns.qty_available && <td className="px-6 py-4 text-right font-mono font-bold text-zinc-900">{row.qty_available}</td>}
                        {visibleColumns.cost_price && <td className="px-6 py-4 text-right font-mono text-zinc-900">${row.cost_price.toFixed(2)}</td>}
                        {visibleColumns.selling_price && <td className="px-6 py-4 text-right font-mono text-zinc-900">${row.selling_price.toFixed(2)}</td>}
                        {visibleColumns.total_cost_value && <td className="px-6 py-4 text-right font-mono font-bold text-amber-600">${row.total_cost_value.toFixed(2)}</td>}
                        {visibleColumns.expiry_date && (
                          <td className="px-6 py-4 font-mono text-zinc-600">
                            {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : 'N/A'}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-zinc-200 bg-white flex items-center justify-between">
              <div className="text-xs text-zinc-500 font-mono">
                Showing {((data.table.pagination.page - 1) * data.table.pagination.limit) + 1} to {Math.min(data.table.pagination.page * data.table.pagination.limit, data.table.pagination.total)} of {data.table.pagination.total}
              </div>
              <div className="flex gap-1">
                <button 
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.table.pagination.page === 1 || isLoading}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider rounded"
                >
                  Prev
                </button>
                <button 
                  type="button"
                  onClick={() => setPage(p => Math.min(data.table.pagination.totalPages, p + 1))}
                  disabled={data.table.pagination.page === data.table.pagination.totalPages || data.table.pagination.totalPages === 0 || isLoading}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
