"use client";

import Swal from "sweetalert2";
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, PackageOpen, Tag, UserCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface POSItem {
  id: string; // unique cart id
  product_id: string;
  name: string;
  batch_id: string;
  batch_number: string;
  price: number; 
  cost_price: number;
  qty: number;
  max_qty: number;
  discount: number; // percentage
}

export default function PosSellPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const [cart, setCart] = useState<POSItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [taxRate] = useState<number>(0.05);

  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  const flatSearchResults = useMemo(() => {
    return searchResults.flatMap(product => 
      (product.batches || []).map((batch: any) => ({ product, batch }))
    );
  }, [searchResults]);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI" | "OTHER">("CASH");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Resizable right panel
  const [rightWidth, setRightWidth] = useState(380);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = rightWidth;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = 'none'; // prevent text selection while dragging
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const delta = startX.current - e.clientX;
    let newWidth = startWidth.current + delta;
    if (newWidth < 300) newWidth = 300;
    if (newWidth > 800) newWidth = 800;
    setRightWidth(newWidth);
  };

  const onMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = '';
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + ((item.price * item.qty) * (1 - item.discount / 100)), 0);
  const discountAmount = subtotal * (overallDiscount / 100);
  const taxAmount = (subtotal - discountAmount) * taxRate;
  const total = subtotal - discountAmount + taxAmount;

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPaymentModal) return; // Disable shortcuts when modal is open
      
      if (e.key === "F2" || (e.key === "/" && document.activeElement !== searchInputRef.current && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      }
      if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0 && !isProcessing) setShowPaymentModal(true);
      }
      
      // Navigation
      if (flatSearchResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, flatSearchResults.length - 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const selected = flatSearchResults[selectedIndex];
          if (selected) {
             const isAdded = cart.find(c => c.batch_id === selected.batch._id)?.qty === selected.batch.qty_available;
             if (!isAdded) {
               addToCart(selected.product, selected.batch);
             }
          }
        }
      }
      
      if (e.key === "Escape") {
        setSearchQuery("");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, showPaymentModal, isProcessing, flatSearchResults, selectedIndex]);

  // Search API Call
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await axios.get('/api/pos/search', { params: { q: searchQuery } });
        setSearchResults(res.data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
        setSelectedIndex(0);
      }
    }, 200); 
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!customerSearchQuery.trim()) {
        setCustomerSearchResults([]);
        return;
      }
      if (selectedCustomer && customerSearchQuery === selectedCustomer.name) {
        return;
      }
      setIsSearchingCustomer(true);
      try {
        const res = await axios.get('/api/customers', { params: { q: customerSearchQuery, limit: 5 } });
        setCustomerSearchResults(res.data.customers);
        setShowCustomerResults(true);
      } catch (err) {
        console.error("Customer search failed", err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 300); 
    return () => clearTimeout(timer);
  }, [customerSearchQuery, selectedCustomer]);

  const addToCart = (product: any, batch: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product._id && item.batch_id === batch._id);
      if (existing) {
        if (existing.qty < batch.qty_available) {
          return prev.map(item => 
            item.id === existing.id ? { ...item, qty: item.qty + 1 } : item
          );
        }
        return prev;
      }
      
      return [...prev, {
        id: `${product._id}-${batch._id}`,
        product_id: product._id,
        name: product.name,
        batch_id: batch._id,
        batch_number: batch.batch_number,
        price: batch.selling_price || 0,
        cost_price: batch.cost_price || 0,
        qty: 1,
        max_qty: batch.qty_available,
        discount: 0
      }];
    });
    searchInputRef.current?.focus();
  };

  const updateQty = (id: string, newQty: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (newQty > 0 && newQty <= item.max_qty) {
          return { ...item, qty: newQty };
        }
      }
      return item;
    }));
  };

  const updateItemDiscount = (id: string, newDisc: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, discount: Math.max(0, Math.min(100, newDisc || 0)) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (isProcessing) return; 
    setIsProcessing(true);
    try {
      const payload = {
        customer_id: selectedCustomer?._id || undefined,
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        items: cart.map(item => ({
          product_id: item.product_id,
          batch_id: item.batch_id,
          qty: item.qty,
          price: item.price,
          discount: item.discount,
          cost_price: item.cost_price
        }))
      };

      const res = await axios.post("/api/pos/sell", payload);
      Swal.fire('Success', String(`Sale completed! Invoice ID: ${res.data.sale_id}`), 'success');
      setCart([]);
      setOverallDiscount(0);
      setShowPaymentModal(false);
      setSearchQuery("");
      setSelectedCustomer(null);
      setCustomerSearchQuery("");
      searchInputRef.current?.focus();
    } catch (err: any) {
      Swal.fire('Error', String(err.response?.data?.error || "Failed to process sale"), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden bg-surface  text-foreground">
      
      {/* Left Panel: Search & Products */}
      <div className="flex-1 flex flex-col bg-white z-0">
        <div className="p-3 border-b border-border bg-white sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search barcode, composition or name [F2 or /]"
              className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 bg-background/50">
          {searchQuery ? (
            isSearching ? (
              <div className="text-center text-xs text-muted-foreground mt-6">Searching...</div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {searchResults.map(product => {
                  const hasStock = product.batches && product.batches.length > 0;
                  return (
                    <div key={product._id} className="bg-white border border-border rounded-lg shadow-sm p-3 flex flex-col gap-2 hover:border-primary/40 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{product.name}</h3>
                          <p className="text-xs text-muted-foreground">{product.generic_name || product.brand}</p>
                          {product.active_ingredients && (
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 max-w-sm truncate" title={product.active_ingredients}>Comp: {product.active_ingredients}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!hasStock && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                              Out of Stock
                            </span>
                          )}
                          {product.barcode && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                              {product.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {hasStock && (
                        <div className="pt-2 mt-1 border-t border-border/50 flex flex-col gap-1.5">
                          {product.batches.map((batch: any, idx: number) => {
                            const isAdded = cart.find(c => c.batch_id === batch._id)?.qty === batch.qty_available;
                            const isSelected = flatSearchResults.findIndex(f => f.batch._id === batch._id) === selectedIndex;
                            return (
                              <div key={batch._id} className={`flex items-center justify-between group p-1.5 rounded -mx-1.5 transition-colors ${isSelected ? "bg-primary/10 border border-primary/30 shadow-sm" : "border border-transparent"}`}>
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-foreground/80 font-mono">
                                      #{batch.batch_number}
                                      {idx === 0 && <span className="ml-2 text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded uppercase tracking-wide border border-emerald-100">Best Expiry</span>}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      Stock: {batch.qty_available} &middot; Exp: {batch.expiry_date || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-foreground">${batch.selling_price?.toFixed(2)}</span>
                                  <button
                                    onClick={() => addToCart(product, batch)}
                                    disabled={isAdded}
                                    className={`h-7 px-3 text-xs font-bold rounded border transition-colors cursor-pointer ${
                                      isAdded 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 disabled:opacity-100 disabled:cursor-not-allowed" 
                                        : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                    }`}
                                  >
                                    {isAdded ? "Added" : "Add"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground mt-6">No matching products found.</div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
              <PackageOpen className="w-12 h-12 mb-3 stroke-[1.5]" />
              <p className="text-sm font-medium">Ready for next customer</p>
            </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div 
        onMouseDown={startResizing}
        className="w-1 bg-secondary hover:bg-primary/50 cursor-col-resize z-20 active:bg-indigo-500 transition-colors"
      />

      {/* Right Panel: Cart & Summary */}
      <div style={{ width: rightWidth }} className="bg-white flex flex-col relative z-10 shrink-0">
        {/* Customer Selection */}
        <div className="p-3 border-b border-border bg-surface shrink-0 relative">
          <div className="flex items-center bg-white border border-border rounded focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 min-h-[34px]">
            <UserCircle className="w-4 h-4 text-muted-foreground mx-2 shrink-0" />
            {selectedCustomer ? (
              <div className="flex-1 flex justify-between items-center bg-primary/5 border border-primary/20 rounded-md px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shadow-sm border border-primary/10">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-primary-foreground leading-none mb-1">{selectedCustomer.name}</div>
                    <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <UserCircle className="w-3 h-3" /> {selectedCustomer.phone || selectedCustomer.email || "No contact info"}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedCustomer(null); setCustomerSearchQuery(""); }}
                  className="p-1.5 bg-white border border-border hover:bg-red-50 text-muted-foreground hover:text-red-500 rounded-md shadow-sm transition-all"
                  title="Remove customer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center relative">
                <input
                  type="text"
                  placeholder="Search customer (optional)"
                  className="w-full pl-1 pr-7 py-1.5 text-sm outline-none bg-transparent"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  onFocus={() => setShowCustomerResults(true)}
                  onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                />
                {customerSearchQuery && (
                  <button 
                    onClick={() => { setCustomerSearchQuery(""); setCustomerSearchResults([]); }}
                    className="absolute right-1 p-1 text-muted-foreground hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Dropdown for customer search results */}
          {showCustomerResults && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50">
              {customerSearchResults.length > 0 ? (
                customerSearchResults.map(c => (
                  <div 
                    key={c._id} 
                    className="px-3 py-2 hover:bg-surface cursor-pointer border-b border-border last:border-0 flex justify-between items-center"
                    onMouseDown={() => {
                      setSelectedCustomer(c);
                      setCustomerSearchQuery(c.name);
                      setShowCustomerResults(false);
                    }}
                  >
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.email || c.customer_id}</div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground border-b border-border">
                  No customers found matching "{customerSearchQuery}"
                </div>
              )}
              
              <div 
                className="px-3 py-2.5 bg-surface/50 hover:bg-primary/5 cursor-pointer flex items-center justify-center gap-2 text-primary text-sm font-medium transition-colors"
                onMouseDown={() => {
                  window.open('/dashboard/customers/add', '_blank');
                  setShowCustomerResults(false);
                }}
              >
                <Plus className="w-4 h-4" /> Add New Customer
              </div>
            </div>
          )}
        </div>

        <div className="h-12 border-b border-border bg-surface flex justify-between items-center px-4 shrink-0">
          <span className="font-semibold text-sm text-foreground flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Cart Items
          </span>
          <span className="text-xs font-bold bg-secondary text-foreground/80 px-2 py-0.5 rounded-full">
            {cart.length}
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto bg-white p-2">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground/80 text-xs font-medium">
              Cart is empty
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {cart.map(item => (
                <div key={item.id} className="group flex flex-col p-3 rounded-lg border border-border bg-white shadow-sm hover:border-primary/30 hover:shadow transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-3">
                      <div className="text-sm font-bold text-slate-900 leading-tight">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">#{item.batch_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-indigo-700">${(item.price * item.qty * (1 - item.discount / 100)).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">${item.price.toFixed(2)} ea</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/0 group-hover:border-border transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0 bg-white border border-border rounded shadow-sm overflow-hidden h-7">
                        <button 
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          className="w-7 h-full flex items-center justify-center hover:bg-surface text-muted-foreground transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          step="any"
                          value={item.qty}
                          onChange={(e) => updateQty(item.id, parseFloat(e.target.value) || 0)}
                          className="w-24 h-full text-center text-sm font-semibold bg-surface border-x border-border outline-none focus:bg-white focus:ring-1 focus:ring-primary/50"
                        />
                        <button 
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          disabled={item.qty >= item.max_qty}
                          className="w-7 h-full flex items-center justify-center hover:bg-surface text-muted-foreground disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Item-level discount */}
                      <div className="flex items-center bg-white border border-border rounded shadow-sm h-7 overflow-hidden px-1 text-xs focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                        <Tag className="w-3 h-3 text-muted-foreground/80 ml-1" />
                        <input 
                          type="number"
                          value={item.discount === 0 ? "" : item.discount}
                          onChange={(e) => updateItemDiscount(item.id, parseInt(e.target.value))}
                          placeholder="0"
                          className="w-20 text-right outline-none px-1 text-foreground/80 bg-transparent font-medium text-sm"
                        />
                        <span className="text-muted-foreground/80 mr-1">%</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-muted-foreground/80 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ledger Summary */}
        <div className="border-t border-border bg-surface p-4 shrink-0">
          <div className="flex flex-col gap-2 mb-4 text-xs font-medium text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-foreground">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Discount
                <span className="text-[9px] bg-secondary px-1 rounded text-muted-foreground font-mono">F4</span>
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-border rounded h-6 px-1 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 overflow-hidden">
                  <input
                    ref={discountInputRef}
                    type="number"
                    value={overallDiscount === 0 ? "" : overallDiscount}
                    onChange={(e) => setOverallDiscount(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    placeholder="0"
                    className="w-10 text-right outline-none text-foreground/80 bg-transparent text-xs font-bold"
                  />
                  <span className="text-muted-foreground/80 text-xs px-1">%</span>
                </div>
                {overallDiscount > 0 && <span className="text-rose-600 w-12 text-right">-${discountAmount.toFixed(2)}</span>}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Tax ({(taxRate*100).toFixed(0)}%)</span>
              <span className="text-foreground">${taxAmount.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="pt-3 border-t border-border flex justify-between items-baseline mb-4">
            <span className="text-sm font-semibold text-foreground/80">Total</span>
            <span className="text-3xl font-black tracking-tighter text-foreground">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0 || isProcessing}
            className="w-full h-12 bg-primary text-white rounded font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-offset-1 focus:ring-primary cursor-pointer"
          >
            <span>Proceed to Payment</span>
            <span className="bg-primary/80 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium">F9</span>
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border/50 flex justify-between items-center">
              <h3 className="font-bold text-foreground">Complete Payment</h3>
              <div className="text-2xl font-black text-foreground tracking-tighter">${total.toFixed(2)}</div>
            </div>
            
            <div className="p-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex items-center gap-2 p-3 rounded border text-sm font-medium transition-colors cursor-pointer ${paymentMethod === 'CASH' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white hover:border-primary/30 text-foreground/80'}`}
                >
                  <Banknote className="w-4 h-4" /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("CARD")}
                  className={`flex items-center gap-2 p-3 rounded border text-sm font-medium transition-colors cursor-pointer ${paymentMethod === 'CARD' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white hover:border-primary/30 text-foreground/80'}`}
                >
                  <CreditCard className="w-4 h-4" /> Card
                </button>
              </div>
            </div>

            <div className="p-5 bg-surface border-t border-border/50 flex gap-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isProcessing}
                className="flex-1 h-10 bg-white border border-border text-foreground/80 rounded font-medium text-sm hover:bg-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="flex-1 h-10 bg-primary text-white rounded font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center cursor-pointer"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> 
                    Processing
                  </span>
                ) : (
                  "Confirm Sale"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
