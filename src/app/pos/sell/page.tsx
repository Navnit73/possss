"use client";

import Swal from "sweetalert2";
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, PackageOpen, Tag, UserCircle, X, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { InvoiceReceiptModal } from "@/components/pos/InvoiceReceiptModal";

interface POSItem {
  id: string; // unique cart id
  product_id: string;
  name: string;
  batch_id: string;
  batch_number: string;
  rack_number?: string;
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

  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);

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
    document.body.style.userSelect = 'none';
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
      if (showPaymentModal || completedSaleId) return;
      
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
  }, [cart.length, showPaymentModal, completedSaleId, isProcessing, flatSearchResults, selectedIndex]);

  // Fast Product Search API Call (80ms debounce for high-speed responsiveness)
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
    }, 80); 
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
    }, 150); 
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
        rack_number: batch.rack_number || product.rack_number || product.rack || "N/A",
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
    const validQty = isNaN(newQty) ? 0 : newQty;
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const clampedQty = Math.max(0, Math.min(item.max_qty, validQty));
        return { ...item, qty: clampedQty };
      }
      return item;
    }));
  };

  const updateItemDiscount = (id: string, rawDisc: number) => {
    const validDisc = isNaN(rawDisc) ? 0 : rawDisc;
    const clampedDisc = Math.max(0, Math.min(100, validDisc));
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, discount: clampedDisc };
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
      
      // Complete sale & show printable receipt modal
      setCart([]);
      setOverallDiscount(0);
      setShowPaymentModal(false);
      setSearchQuery("");
      setSelectedCustomer(null);
      setCustomerSearchQuery("");
      setCompletedSaleId(res.data.sale_id);
    } catch (err: any) {
      Swal.fire('Error', String(err.response?.data?.error || "Failed to process sale"), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden bg-slate-50 text-slate-900 font-sans">
      
      {/* Left Panel: Search & Products */}
      <div className="flex-1 flex flex-col bg-white z-0 border-r border-slate-200">
        <div className="p-3.5 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search barcode, composition or medicine name [F2 or /]"
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 bg-slate-50/60">
          {searchQuery ? (
            isSearching ? (
              <div className="text-center text-xs font-semibold text-slate-400 mt-8">Searching medicines...</div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5">
                {searchResults.map(product => {
                  const hasStock = product.batches && product.batches.length > 0;
                  return (
                    <div key={product._id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2 hover:border-emerald-400 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{product.name}</h3>
                          <p className="text-xs text-slate-500 font-medium">{product.generic_name || product.brand}</p>
                          {product.active_ingredients && (
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm truncate" title={product.active_ingredients}>Comp: {product.active_ingredients}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                            <MapPin className="w-3 h-3 text-amber-600" />
                            Rack: {product.rack_number || product.rack || "Unassigned"}
                          </span>
                          {!hasStock && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              Out of Stock
                            </span>
                          )}
                          {product.barcode && (
                            <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {product.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {hasStock && (
                        <div className="pt-2 mt-1 border-t border-slate-100 flex flex-col gap-1.5">
                          {product.batches.map((batch: any, idx: number) => {
                            const isAdded = cart.find(c => c.batch_id === batch._id)?.qty === batch.qty_available;
                            const isSelected = flatSearchResults.findIndex(f => f.batch._id === batch._id) === selectedIndex;
                            const rackLocation = batch.rack_number || product.rack_number || product.rack || "N/A";
                            return (
                              <div key={batch._id} className={`flex items-center justify-between group p-2 rounded-lg transition-all ${isSelected ? "bg-emerald-50/80 border border-emerald-300" : "border border-transparent hover:bg-slate-50"}`}>
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-800 font-mono">
                                        #{batch.batch_number}
                                        {idx === 0 && <span className="ml-2 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full uppercase tracking-wide border border-emerald-200">Best Expiry</span>}
                                      </span>
                                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300 flex items-center gap-0.5">
                                        <MapPin className="w-2.5 h-2.5 text-amber-600" />
                                        Rack: {rackLocation}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Stock: <span className="font-bold text-slate-700">{batch.qty_available}</span> &middot; Exp: {batch.expiry_date || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-extrabold text-slate-900">${batch.selling_price?.toFixed(2)}</span>
                                  <button
                                    onClick={() => addToCart(product, batch)}
                                    disabled={isAdded}
                                    className={`h-7 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                      isAdded 
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300 disabled:opacity-100 disabled:cursor-not-allowed" 
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
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
              <div className="text-center text-xs font-semibold text-slate-400 mt-8">No matching medicines found.</div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <PackageOpen className="w-14 h-14 mb-3 text-emerald-400 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-500">Ready for next customer</p>
              <p className="text-xs text-slate-400 mt-1">Search medicine name or scan barcode to add to cart</p>
            </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div 
        onMouseDown={startResizing}
        className="w-1 bg-slate-200 hover:bg-emerald-500 cursor-col-resize z-20 active:bg-emerald-600 transition-colors"
      />

      {/* Right Panel: Cart & Summary */}
      <div style={{ width: rightWidth }} className="bg-white flex flex-col relative z-10 shrink-0 border-l border-slate-200">
        {/* Customer Selection */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/80 shrink-0 relative">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 min-h-[36px] shadow-2xs">
            <UserCircle className="w-4 h-4 text-emerald-600 mx-2.5 shrink-0" />
            {selectedCustomer ? (
              <div className="flex-1 flex justify-between items-center bg-amber-50/90 border border-amber-200 rounded-md px-3 py-1.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none mb-0.5">{selectedCustomer.name}</div>
                    <div className="text-[10px] text-amber-800 font-medium flex items-center gap-1">
                      {selectedCustomer.phone || selectedCustomer.email || "Registered Patient"}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedCustomer(null); setCustomerSearchQuery(""); }}
                  className="p-1 bg-white border border-amber-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded shadow-2xs transition-all cursor-pointer"
                  title="Remove customer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center relative">
                <input
                  type="text"
                  placeholder="Search customer (optional)"
                  className="w-full pl-1 pr-7 py-1.5 text-xs font-medium outline-none bg-transparent"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  onFocus={() => setShowCustomerResults(true)}
                  onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                />
                {customerSearchQuery && (
                  <button 
                    onClick={() => { setCustomerSearchQuery(""); setCustomerSearchResults([]); }}
                    className="absolute right-1 p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Dropdown for customer search results */}
          {showCustomerResults && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              {customerSearchResults.length > 0 ? (
                customerSearchResults.map(c => (
                  <div 
                    key={c._id} 
                    className="px-3.5 py-2.5 hover:bg-emerald-50/60 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors"
                    onMouseDown={() => {
                      setSelectedCustomer(c);
                      setCustomerSearchQuery(c.name);
                      setShowCustomerResults(false);
                    }}
                  >
                    <div className="font-bold text-sm text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{c.phone || c.email || c.customer_id}</div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-slate-400 border-b border-slate-100">
                  No customers found matching "{customerSearchQuery}"
                </div>
              )}
              
              <div 
                className="px-3.5 py-2.5 bg-emerald-50/50 hover:bg-emerald-100/60 cursor-pointer flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold transition-colors"
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

        <div className="h-11 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center px-4 shrink-0">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" /> Cart Items
          </span>
          <span className="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {cart.length} {cart.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-medium gap-1">
              <ShoppingCart className="w-8 h-8 text-slate-300 stroke-[1.5]" />
              <span>Cart is empty</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map(item => (
                <div key={item.id} className="group flex flex-col p-3 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <div className="text-xs font-bold text-slate-900 leading-tight">{item.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">#{item.batch_number}</span>
                        <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-amber-600" />
                          Rack: {item.rack_number || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-emerald-700">${(item.price * item.qty * (1 - item.discount / 100)).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400 font-medium">${item.price.toFixed(2)} ea</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-7">
                        <button 
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          className="w-7 h-full flex items-center justify-center hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          step="any"
                          value={item.qty === 0 ? "" : item.qty}
                          onChange={(e) => updateQty(item.id, parseFloat(e.target.value))}
                          className="w-14 h-full text-center text-xs font-bold bg-white border-x border-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button 
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          disabled={item.qty >= item.max_qty}
                          className="w-7 h-full flex items-center justify-center hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Item-level discount */}
                      <div className="flex items-center bg-amber-50/70 border border-amber-200/80 rounded-lg h-7 overflow-hidden px-1.5 text-xs focus-within:border-amber-500">
                        <Tag className="w-3 h-3 text-amber-600 mr-1" />
                        <input 
                          type="number"
                          value={item.discount === 0 ? "" : item.discount}
                          onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value))}
                          placeholder="0"
                          className="w-10 text-right outline-none text-amber-900 bg-transparent font-bold text-xs"
                        />
                        <span className="text-amber-700 text-[10px] font-bold ml-0.5">%</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
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
        <div className="border-t border-slate-200 bg-white p-4 shrink-0 shadow-xs">
          <div className="flex flex-col gap-2 mb-3.5 text-xs font-medium text-slate-600">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-slate-900 font-bold">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Tag className="w-3.5 h-3.5 text-amber-600" /> Bill Discount
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-bold">F4</span>
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-amber-50 border border-amber-200 rounded-md h-6 px-1 focus-within:border-amber-500 overflow-hidden">
                  <input
                    ref={discountInputRef}
                    type="number"
                    value={overallDiscount === 0 ? "" : overallDiscount}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      const valid = isNaN(parsed) ? 0 : parsed;
                      setOverallDiscount(Math.max(0, Math.min(100, valid)));
                    }}
                    placeholder="0"
                    className="w-8 text-right outline-none text-amber-900 bg-transparent text-xs font-bold"
                  />
                  <span className="text-amber-700 text-xs px-0.5 font-bold">%</span>
                </div>
                {overallDiscount > 0 && <span className="text-rose-600 font-bold text-xs">-${discountAmount.toFixed(2)}</span>}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Tax ({(taxRate*100).toFixed(0)}%)</span>
              <span className="text-slate-900 font-bold">${taxAmount.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Payable Total</span>
            <span className="text-3xl font-black tracking-tight text-emerald-600">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0 || isProcessing}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
          >
            <span>Proceed to Payment</span>
            <span className="bg-emerald-700/80 text-emerald-100 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold">F9</span>
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Complete Payment</h3>
                <p className="text-xs text-slate-500">Select customer payment method</p>
              </div>
              <div className="text-2xl font-black text-emerald-600 tracking-tight">${total.toFixed(2)}</div>
            </div>
            
            <div className="p-5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Payment Method</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs' : 'border-slate-200 bg-white hover:border-emerald-300 text-slate-700'}`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600" /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("CARD")}
                  className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${paymentMethod === 'CARD' ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-xs' : 'border-slate-200 bg-white hover:border-sky-300 text-slate-700'}`}
                >
                  <CreditCard className="w-4 h-4 text-sky-600" /> Card
                </button>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-2.5">
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isProcessing}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm transition-all shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-70"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> 
                    Processing...
                  </span>
                ) : (
                  "Confirm Sale"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Printable Receipt Modal */}
      {completedSaleId && (
        <InvoiceReceiptModal
          saleId={completedSaleId}
          onClose={() => setCompletedSaleId(null)}
        />
      )}
    </div>
  );
}
