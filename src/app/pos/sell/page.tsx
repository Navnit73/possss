"use client";

import Swal from "sweetalert2";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import {
  Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, PackageOpen, Tag, UserCircle, X, MapPin,
  Smartphone, Wallet, AlertTriangle, Keyboard,
} from "lucide-react";
import { InvoiceReceiptModal } from "@/components/pos/InvoiceReceiptModal";
import { useCurrency } from "@/context/CurrencyContext";
import { POS_TAX_RATE, computeTotals, lineAmount, round2 } from "@/lib/posMath";

type PaymentMethod = "CASH" | "CARD" | "UPI" | "OTHER";

interface Batch {
  _id: string;
  batch_number: string;
  qty_available: number;
  selling_price: number;
  expiry_date?: string;
  days_to_expiry: number | null;
  rack_number?: string;
}

interface Product {
  _id: string;
  name: string;
  generic_name?: string;
  brand?: string;
  barcode?: string;
  sku?: string;
  strength?: string;
  rack_number?: string;
  active_ingredients?: string;
  requires_prescription?: boolean;
  batches: Batch[];
  expired_batches: number;
}

interface CartItem {
  id: string; // unique cart line id
  product_id: string;
  name: string;
  batch_id: string;
  batch_number: string;
  rack_number: string;
  price: number;
  qty: number;
  max_qty: number;
  discount: number; // percentage
  days_to_expiry: number | null;
  requires_prescription: boolean;
}

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  customer_id?: string;
}

interface Notice {
  id: number;
  kind: "info" | "warn" | "error";
  text: string;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote; key: string }[] = [
  { value: "CASH", label: "Cash", icon: Banknote, key: "1" },
  { value: "CARD", label: "Card", icon: CreditCard, key: "2" },
  { value: "UPI", label: "UPI", icon: Smartphone, key: "3" },
  { value: "OTHER", label: "Other", icon: Wallet, key: "4" },
];

const SHORTCUTS = [
  ["F2", "Search"],
  ["F3", "Customer"],
  ["F4", "Bill discount"],
  ["F8", "Clear cart"],
  ["F9", "Pay"],
  ["↑ ↓ Enter", "Add medicine"],
];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** True while the user is typing in a form field (so single-key shortcuts must not fire). */
const isTyping = (el: EventTarget | null) => {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement | null)?.isContentEditable === true;
};

export default function PosSellPage() {
  const { formatCurrency } = useCurrency();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // ---- product search ----
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<{ query: string; products: Product[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsQuery = useRef(""); // query the current results belong to (lets Enter skip a redundant fetch)
  const latestQuery = useRef(""); // what's in the search box right now (read after an await)
  const enterBusy = useRef(false); // one scanner/Enter lookup at a time

  // ---- cart ----
  const [cart, setCart] = useState<CartItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // ---- customer ----
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerFocused, setCustomerFocused] = useState(false);
  const [customerIndex, setCustomerIndex] = useState(0);
  const [customerError, setCustomerError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // ---- checkout ----
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const submitting = useRef(false); // synchronous lock: state would still allow a fast double-submit
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback((kind: Notice["kind"], text: string) => setNotice({ id: Date.now(), kind, text }), []);

  // ---- resizable cart panel ----
  const [rightWidth, setRightWidth] = useState(380);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = rightWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setRightWidth(Math.max(300, Math.min(800, startWidth.current + (startX.current - ev.clientX))));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "none";
  };

  // ---- derived values ----
  const queryReady = searchQuery.trim().length >= 2;
  const visibleResults = queryReady || (results && results.query === searchQuery.trim()) ? results : null;

  const flatResults = useMemo(
    () => (visibleResults?.products ?? []).flatMap((product) => product.batches.map((batch) => ({ product, batch }))),
    [visibleResults]
  );
  const flatIndexByBatch = useMemo(() => new Map(flatResults.map((f, i) => [f.batch._id, i])), [flatResults]);
  const cartQtyByBatch = useMemo(() => new Map(cart.map((c) => [c.batch_id, c.qty])), [cart]);

  const lineTotals = useMemo(() => cart.map((item) => lineAmount(item.price, item.qty, item.discount)), [cart]);
  const { subtotal, discount: discountAmount, tax: taxAmount, total } = useMemo(
    () => computeTotals(lineTotals, overallDiscount),
    [lineTotals, overallDiscount]
  );
  const hasInvalidQty = cart.some((item) => !(item.qty > 0) || item.qty > item.max_qty);
  const canPay = cart.length > 0 && !hasInvalidQty && !isProcessing;

  // Notices fade away on their own
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.kind === "info" ? 2000 : 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Don't lose an in-progress bill to an accidental refresh / tab close
  useEffect(() => {
    if (cart.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [cart.length]);

  // Return to the search box whenever a modal closes, so the next item can be scanned straight away
  useEffect(() => {
    if (!showPaymentModal && !completedSaleId) searchInputRef.current?.focus();
  }, [showPaymentModal, completedSaleId]);

  // Keep the highlighted result in view when navigating with the arrow keys
  useEffect(() => {
    document.querySelector(`[data-flat-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    latestQuery.current = searchQuery;
  }, [searchQuery]);

  // ---- product search (debounced; stale responses are cancelled) ----
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || resultsQuery.current === q) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const { data } = await axios.get<Product[]>("/api/pos/search", { params: { q }, signal: controller.signal });
        resultsQuery.current = q;
        setResults({ query: q, products: data });
        setSelectedIndex(0);
      } catch (err: any) {
        if (axios.isCancel(err)) return;
        setSearchError(err.response?.data?.error || "Search failed. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
      setIsSearching(false); // an aborted request must not leave the results dimmed forever
    };
  }, [searchQuery]);

  // ---- customer search ----
  useEffect(() => {
    const q = customerQuery.trim();
    if (!q || selectedCustomer) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get("/api/customers", { params: { q, limit: 6, status: "ACTIVE" }, signal: controller.signal });
        setCustomerResults(data.customers ?? []);
        setCustomerIndex(0);
        setCustomerError("");
      } catch (err: any) {
        if (axios.isCancel(err)) return;
        setCustomerResults([]);
        setCustomerError(err.response?.status === 403 ? "You don't have access to customer records." : "Customer search failed.");
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [customerQuery, selectedCustomer]);

  // ---- cart actions ----
  const addToCart = (product: Product, batch: Batch): boolean => {
    if (!(batch.selling_price > 0)) {
      notify("error", `${product.name} has no selling price set — update it in Products first.`);
      return false;
    }
    const existing = cart.find((item) => item.batch_id === batch._id);
    if (existing && existing.qty >= batch.qty_available) {
      notify("warn", `Only ${batch.qty_available} in stock for ${product.name} (#${batch.batch_number}).`);
      return false;
    }

    setCart((prev) => {
      const line = prev.find((item) => item.batch_id === batch._id);
      if (line) {
        // Capped here too: two fast scans both pass the check above against the same (not yet re-rendered) cart
        return prev.map((item) =>
          item.id === line.id ? { ...item, qty: Math.min(item.qty + 1, batch.qty_available), max_qty: batch.qty_available } : item
        );
      }
      return [
        ...prev,
        {
          id: `${product._id}-${batch._id}`,
          product_id: product._id,
          name: product.name,
          batch_id: batch._id,
          batch_number: batch.batch_number,
          rack_number: batch.rack_number || product.rack_number || "N/A",
          price: batch.selling_price,
          qty: 1,
          max_qty: batch.qty_available,
          discount: 0,
          days_to_expiry: batch.days_to_expiry,
          requires_prescription: Boolean(product.requires_prescription),
        },
      ];
    });

    if (product.requires_prescription) {
      notify("warn", `${product.name} needs a prescription — verify it before dispensing.`);
    } else {
      notify("info", `Added ${product.name}`);
    }
    searchInputRef.current?.focus();
    return true;
  };

  const updateQty = (id: string, rawQty: number) => {
    const qty = Number.isNaN(rawQty) ? 0 : Math.max(0, rawQty);
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (qty > item.max_qty) {
          notify("warn", `Only ${item.max_qty} in stock for ${item.name}.`);
          return { ...item, qty: item.max_qty };
        }
        return { ...item, qty };
      })
    );
  };

  const updateItemDiscount = (id: string, raw: number) => {
    const discount = Math.max(0, Math.min(100, Number.isNaN(raw) ? 0 : raw));
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, discount } : item)));
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((item) => item.id !== id));

  const clearCart = async () => {
    if (cart.length === 0) return;
    const { isConfirmed } = await Swal.fire({
      title: "Clear the whole cart?",
      text: `${cart.length} item${cart.length === 1 ? "" : "s"} will be removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, clear it",
    });
    if (isConfirmed) {
      setCart([]);
      setOverallDiscount(0);
    }
    searchInputRef.current?.focus();
  };

  // ---- search "Enter": scanner / keyboard add ----
  const submitSearch = async () => {
    const q = searchQuery.trim();
    if (!q || enterBusy.current) return;
    enterBusy.current = true;
    try {
      await lookupAndAdd(q);
    } finally {
      enterBusy.current = false;
    }
  };

  /** Clears the search box only if it still holds the query that was just added (a scanner may already be typing the next code). */
  const clearSearchIfUnchanged = (q: string) => setSearchQuery((cur) => (cur.trim() === q ? "" : cur));

  const lookupAndAdd = async (q: string) => {
    let products: Product[];
    const fresh = results !== null && results.query === q;
    if (fresh) {
      products = results.products;
    } else {
      // A scanner sends the code and Enter faster than the debounce: fetch right now instead of waiting.
      setIsSearching(true);
      try {
        const { data } = await axios.get<Product[]>("/api/pos/search", { params: { q } });
        products = data;
        // Don't overwrite newer results if the cashier kept typing while this was in flight
        if (latestQuery.current.trim() === q) {
          resultsQuery.current = q;
          setResults({ query: q, products: data });
          setSelectedIndex(0);
          setSearchError("");
        }
      } catch (err: any) {
        setSearchError(err.response?.data?.error || "Search failed. Check your connection and try again.");
        return;
      } finally {
        setIsSearching(false);
      }
    }

    const lower = q.toLowerCase();
    const exact = products.find((p) => p.barcode?.toLowerCase() === lower || p.sku?.toLowerCase() === lower);
    if (exact) {
      if (exact.batches.length === 0) {
        notify("error", exact.expired_batches > 0 ? `${exact.name}: only expired stock left.` : `${exact.name} is out of stock.`);
        return;
      }
      if (addToCart(exact, exact.batches[0])) clearSearchIfUnchanged(q);
      return;
    }

    const flat = products.flatMap((product) => product.batches.map((batch) => ({ product, batch })));
    // Results the cashier has already seen: add the highlighted one. Results that just arrived: only auto-add an unambiguous hit.
    const pick = fresh ? flat[selectedIndex] : flat.length === 1 ? flat[0] : undefined;
    if (pick) {
      if (addToCart(pick.product, pick.batch)) clearSearchIfUnchanged(q);
    } else if (flat.length === 0) {
      notify("warn", products.length ? "No sellable stock for that medicine." : "No matching medicines found.");
    } else {
      notify("info", "Several matches — pick one with ↑ ↓ and Enter.");
    }
  };

  // ---- checkout ----
  const handleCheckout = async (paymentMethod: PaymentMethod) => {
    if (submitting.current || !canPay) return;
    submitting.current = true;
    setIsProcessing(true);
    setCheckoutError("");

    const payload = {
      customer_id: selectedCustomer?._id || undefined,
      discount: discountAmount,
      payment_method: paymentMethod,
      items: cart.map((item) => ({ product_id: item.product_id, batch_id: item.batch_id, qty: item.qty, discount: item.discount })),
    };

    // Retrying the same bill reuses its key (so the server can't bill it twice); any change to the bill gets a new one.
    // The payment method is deliberately left out: switching Cash -> Card after a timed-out attempt must keep the key,
    // so the server answers 409 (if the first attempt went through) instead of billing the cart a second time.
    const signature = JSON.stringify({ ...payload, payment_method: undefined });
    if (!attempt.current || attempt.current.signature !== signature) attempt.current = { signature, key: newKey() };

    try {
      const res = await axios.post("/api/pos/sell", { ...payload, idempotency_key: attempt.current.key }, { timeout: 20_000 });

      attempt.current = null;
      setCart([]);
      setOverallDiscount(0);
      setShowPaymentModal(false);
      setSearchQuery("");
      setResults(null);
      resultsQuery.current = "";
      setSelectedCustomer(null);
      setCustomerQuery("");
      setCustomerResults([]);
      setCompletedSaleId(res.data.sale_id);
    } catch (err: any) {
      setCheckoutError(
        err.response?.data?.error ||
          (err.response ? "Failed to process sale" : "No response from the server. It's safe to press Confirm again — you won't be billed twice.")
      );
    } finally {
      submitting.current = false;
      setIsProcessing(false);
    }
  };

  // ---- keyboard shortcuts ----
  // One stable window listener that always calls the latest handler (no re-subscribing on every keystroke/cart change).
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (showPaymentModal || completedSaleId || e.defaultPrevented) return; // those modals handle their own keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const typing = isTyping(e.target);
      const inSearch = e.target === searchInputRef.current;

      if (e.key === "F2" || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "F3") {
        e.preventDefault();
        customerInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      } else if (e.key === "F8") {
        e.preventDefault();
        void clearCart();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (canPay) setShowPaymentModal(true);
        else if (hasInvalidQty) notify("warn", "Fix the quantities in the cart first.");
      } else if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        else if (typing) (e.target as HTMLElement).blur();
      } else if (inSearch) {
        // Result navigation only applies while the search box has focus — never while typing a quantity/discount elsewhere
        if (e.key === "ArrowDown" && flatResults.length > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
        } else if (e.key === "ArrowUp" && flatResults.length > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          void submitSearch();
        }
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const onCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const open = customerFocused && customerQuery.trim() && customerResults.length > 0;
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setCustomerIndex((i) => Math.min(i + 1, customerResults.length - 1));
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setCustomerIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      chooseCustomer(customerResults[customerIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault(); // handled here — the global handler must not also clear the product search
      setCustomerFocused(false);
      e.currentTarget.blur();
    }
  };

  const chooseCustomer = (customer: Customer | undefined) => {
    if (!customer) return;
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setCustomerFocused(false);
    searchInputRef.current?.focus();
  };

  const showCustomerDropdown = customerFocused && customerQuery.trim().length > 0 && !selectedCustomer;

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col md:flex-row overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Left Panel: Search & Products */}
      <div className="flex-1 min-h-0 flex flex-col bg-white z-0 md:border-r border-slate-200">
        <div className="p-3.5 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs space-y-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              role="combobox"
              aria-label="Search medicines by name, brand, composition or barcode"
              aria-expanded={flatResults.length > 0}
              aria-controls="pos-search-results"
              autoComplete="off"
              placeholder="Search name, brand, composition or scan barcode  [F2 or /]"
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Shortcut legend */}
          <div className="hidden md:flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500" aria-label="Keyboard shortcuts">
            <Keyboard className="w-3 h-3 text-slate-400" aria-hidden />
            {SHORTCUTS.map(([keys, label]) => (
              <span key={keys} className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono font-bold text-slate-600">{keys}</kbd>
                {label}
              </span>
            ))}
          </div>

          {notice && (
            <div
              role={notice.kind === "error" ? "alert" : "status"}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-2 ${
                notice.kind === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : notice.kind === "warn"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
            >
              {notice.kind !== "info" && <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />}
              {notice.text}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 bg-slate-50/60">
          {searchQuery.trim() ? (
            searchError ? (
              <div className="text-center text-xs font-semibold text-rose-600 mt-8" role="alert">{searchError}</div>
            ) : !visibleResults ? (
              <div className="text-center text-xs font-semibold text-slate-400 mt-8" role="status">
                {queryReady ? "Searching medicines..." : "Type at least 2 characters (or scan a barcode and press Enter)."}
              </div>
            ) : visibleResults.products.length > 0 ? (
              <div id="pos-search-results" role="listbox" aria-label="Matching medicines" className={`grid grid-cols-1 gap-2.5 transition-opacity ${isSearching ? "opacity-60" : ""}`}>
                {visibleResults.products.map((product) => {
                  const hasStock = product.batches.length > 0;
                  return (
                    <div key={product._id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2 hover:border-emerald-400 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                            {product.name}
                            {product.strength && <span className="text-xs font-semibold text-slate-500">{product.strength}</span>}
                            {product.requires_prescription && (
                              <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Rx</span>
                            )}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">{[product.brand, product.generic_name].filter(Boolean).join(" · ")}</p>
                          {product.active_ingredients && (
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm truncate" title={product.active_ingredients}>Comp: {product.active_ingredients}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                            <MapPin className="w-3 h-3 text-amber-600" aria-hidden />
                            Rack: {product.rack_number || "Unassigned"}
                          </span>
                          {!hasStock && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              {product.expired_batches > 0 ? "Only expired stock" : "Out of Stock"}
                            </span>
                          )}
                          {product.barcode && (
                            <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{product.barcode}</span>
                          )}
                        </div>
                      </div>

                      {hasStock && (
                        <div className="pt-2 mt-1 border-t border-slate-100 flex flex-col gap-1.5">
                          {product.batches.map((batch, idx) => {
                            const flatIndex = flatIndexByBatch.get(batch._id) ?? -1;
                            const inCart = cartQtyByBatch.get(batch._id) ?? 0;
                            const isFull = inCart >= batch.qty_available;
                            const isSelected = flatIndex === selectedIndex;
                            const expiringSoon = batch.days_to_expiry !== null && batch.days_to_expiry <= 30;
                            const rackLocation = batch.rack_number || product.rack_number || "N/A";
                            return (
                              <div
                                key={batch._id}
                                role="option"
                                aria-selected={isSelected}
                                data-flat-index={flatIndex}
                                className={`flex items-center justify-between group p-2 rounded-lg transition-all ${isSelected ? "bg-emerald-50/80 border border-emerald-300" : "border border-transparent hover:bg-slate-50"}`}
                              >
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-800 font-mono">
                                      #{batch.batch_number}
                                      {idx === 0 && <span className="ml-2 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide border border-emerald-200">Best Expiry</span>}
                                    </span>
                                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-0.5">
                                      <MapPin className="w-2.5 h-2.5 text-amber-600" aria-hidden />
                                      Rack: {rackLocation}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    Stock: <span className="font-bold text-slate-700">{batch.qty_available}</span> &middot; Exp:{" "}
                                    <span className={expiringSoon ? "font-bold text-amber-700" : ""}>{batch.expiry_date || "N/A"}</span>
                                    {expiringSoon && <span className="ml-1 font-bold text-amber-700">({batch.days_to_expiry === 0 ? "expires today" : `${batch.days_to_expiry}d left`})</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-extrabold text-slate-900">{formatCurrency(batch.selling_price)}</span>
                                  <button
                                    onClick={() => addToCart(product, batch)}
                                    disabled={isFull}
                                    aria-label={`Add ${product.name} batch ${batch.batch_number} to cart`}
                                    className={`h-7 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                      isFull
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300 disabled:opacity-100 disabled:cursor-not-allowed"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                    }`}
                                  >
                                    {isFull ? "Max added" : inCart > 0 ? `Add (${inCart})` : "Add"}
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
              <PackageOpen className="w-14 h-14 mb-3 text-emerald-400 stroke-[1.5]" aria-hidden />
              <p className="text-sm font-semibold text-slate-500">Ready for next customer</p>
              <p className="text-xs text-slate-400 mt-1">Search a medicine or scan a barcode — press Enter to add it</p>
            </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="hidden md:block w-1 bg-slate-200 hover:bg-emerald-500 cursor-col-resize z-20 active:bg-emerald-600 transition-colors"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize cart panel"
      />

      {/* Right Panel: Cart & Summary */}
      <div
        style={{ "--cart-w": `${rightWidth}px` } as React.CSSProperties}
        className="bg-white flex flex-col relative z-10 shrink-0 w-full md:w-[var(--cart-w)] h-[55%] md:h-auto border-t md:border-t-0 md:border-l border-slate-200"
      >
        {/* Customer Selection */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/80 shrink-0 relative">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 min-h-[36px] shadow-2xs">
            <UserCircle className="w-4 h-4 text-emerald-600 mx-2.5 shrink-0" aria-hidden />
            {selectedCustomer ? (
              <div className="flex-1 flex justify-between items-center bg-amber-50/90 border border-amber-200 rounded-md px-3 py-1.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none mb-0.5">{selectedCustomer.name}</div>
                    <div className="text-[10px] text-amber-800 font-medium">{selectedCustomer.phone || selectedCustomer.email || "Registered Patient"}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); customerInputRef.current?.focus(); }}
                  className="p-1 bg-white border border-amber-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded shadow-2xs transition-all cursor-pointer"
                  title="Remove customer"
                  aria-label="Remove customer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center relative">
                <input
                  ref={customerInputRef}
                  type="text"
                  role="combobox"
                  aria-label="Search customer by name, phone or email (optional)"
                  aria-expanded={showCustomerDropdown}
                  aria-controls="pos-customer-results"
                  autoComplete="off"
                  placeholder="Customer (optional)  [F3]"
                  className="w-full pl-1 pr-7 py-1.5 text-xs font-medium outline-none bg-transparent"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onFocus={() => setCustomerFocused(true)}
                  onBlur={() => setTimeout(() => setCustomerFocused(false), 150)}
                  onKeyDown={onCustomerKeyDown}
                />
                {customerQuery && (
                  <button
                    onClick={() => { setCustomerQuery(""); setCustomerResults([]); customerInputRef.current?.focus(); }}
                    className="absolute right-1 p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    aria-label="Clear customer search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {showCustomerDropdown && (
            <div id="pos-customer-results" role="listbox" aria-label="Matching customers" className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              {customerError ? (
                <div className="px-3 py-4 text-center text-xs text-rose-600 border-b border-slate-100">{customerError}</div>
              ) : customerResults.length > 0 ? (
                customerResults.map((c, i) => (
                  <div
                    key={c._id}
                    role="option"
                    aria-selected={i === customerIndex}
                    className={`px-3.5 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors ${i === customerIndex ? "bg-emerald-50" : "hover:bg-emerald-50/60"}`}
                    onMouseDown={(e) => { e.preventDefault(); chooseCustomer(c); }}
                  >
                    <div className="font-bold text-sm text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{c.phone || c.email || c.customer_id}</div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-slate-400 border-b border-slate-100">
                  No customers found matching &ldquo;{customerQuery}&rdquo;
                </div>
              )}

              <a
                href="/dashboard/customers/add"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 bg-emerald-50/50 hover:bg-emerald-100/60 flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Plus className="w-4 h-4" /> Add New Customer
              </a>
            </div>
          )}
        </div>

        <div className="h-11 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center px-4 shrink-0">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" aria-hidden /> Cart Items
          </span>
          <span className="flex items-center gap-2">
            {cart.length > 0 && (
              <button onClick={() => void clearCart()} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer" title="Clear cart (F8)">
                Clear
              </button>
            )}
            <span className="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {cart.length} {cart.length === 1 ? "item" : "items"}
            </span>
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-medium gap-1">
              <ShoppingCart className="w-8 h-8 text-slate-300 stroke-[1.5]" aria-hidden />
              <span>Cart is empty</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {cart.map((item, i) => {
                const invalid = !(item.qty > 0) || item.qty > item.max_qty;
                const expiringSoon = item.days_to_expiry !== null && item.days_to_expiry <= 30;
                return (
                  <li key={item.id} className={`group flex flex-col p-3 rounded-xl border bg-white shadow-2xs transition-all ${invalid ? "border-rose-300" : "border-slate-200 hover:border-emerald-300 hover:shadow-xs"}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2 min-w-0">
                        <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5 flex-wrap">
                          {item.name}
                          {item.requires_prescription && <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1 rounded">Rx</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-mono">#{item.batch_number}</span>
                          <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-amber-600" aria-hidden />
                            Rack: {item.rack_number}
                          </span>
                          {expiringSoon && <span className="text-[9px] font-bold text-amber-700">Expires in {item.days_to_expiry}d</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-700">{formatCurrency(lineTotals[i])}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{formatCurrency(item.price)} ea</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-7">
                          <button
                            onClick={() => (item.qty <= 1 ? removeFromCart(item.id) : updateQty(item.id, item.qty - 1))}
                            aria-label={item.qty <= 1 ? `Remove ${item.name}` : `Decrease quantity of ${item.name}`}
                            className="w-7 h-full flex items-center justify-center hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            max={item.max_qty}
                            aria-label={`Quantity of ${item.name}`}
                            value={item.qty === 0 ? "" : item.qty}
                            onChange={(e) => updateQty(item.id, parseFloat(e.target.value))}
                            onBlur={() => item.qty <= 0 && updateQty(item.id, 1)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-14 h-full text-center text-xs font-bold bg-white border-x border-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            disabled={item.qty >= item.max_qty}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-7 h-full flex items-center justify-center hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Item-level discount */}
                        <div className="flex items-center bg-amber-50/70 border border-amber-200/80 rounded-lg h-7 overflow-hidden px-1.5 text-xs focus-within:border-amber-500">
                          <Tag className="w-3 h-3 text-amber-600 mr-1" aria-hidden />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`Discount percent for ${item.name}`}
                            value={item.discount === 0 ? "" : item.discount}
                            onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value))}
                            onWheel={(e) => e.currentTarget.blur()}
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
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Ledger Summary */}
        <div className="border-t border-slate-200 bg-white p-4 shrink-0 shadow-xs">
          <div className="flex flex-col gap-2 mb-3.5 text-xs font-medium text-slate-600">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-slate-900 font-bold">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center">
              <label htmlFor="bill-discount" className="flex items-center gap-1.5 text-slate-600">
                <Tag className="w-3.5 h-3.5 text-amber-600" aria-hidden /> Bill Discount
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">F4</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-amber-50 border border-amber-200 rounded-md h-6 px-1 focus-within:border-amber-500 overflow-hidden">
                  <input
                    id="bill-discount"
                    ref={discountInputRef}
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={overallDiscount === 0 ? "" : overallDiscount}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      setOverallDiscount(Math.max(0, Math.min(100, Number.isNaN(parsed) ? 0 : parsed)));
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0"
                    className="w-10 text-right outline-none text-amber-900 bg-transparent text-xs font-bold"
                  />
                  <span className="text-amber-700 text-xs px-0.5 font-bold">%</span>
                </div>
                {overallDiscount > 0 && <span className="text-rose-600 font-bold text-xs">-{formatCurrency(discountAmount)}</span>}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Tax ({(POS_TAX_RATE * 100).toFixed(0)}%)</span>
              <span className="text-slate-900 font-bold">{formatCurrency(taxAmount)}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Payable Total</span>
            <span className="text-3xl font-black tracking-tight text-emerald-600">{formatCurrency(total)}</span>
          </div>

          <button
            onClick={() => { setCheckoutError(""); setShowPaymentModal(true); }}
            disabled={!canPay}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
          >
            <span>Proceed to Payment</span>
            <span className="bg-emerald-700/80 text-emerald-100 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold">F9</span>
          </button>
          {hasInvalidQty && <p className="text-[11px] text-rose-600 font-semibold mt-2 text-center" role="alert">Fix the highlighted quantities to continue.</p>}
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          total={total}
          isProcessing={isProcessing}
          error={checkoutError}
          formatCurrency={formatCurrency}
          onCancel={() => setShowPaymentModal(false)}
          onConfirm={handleCheckout}
        />
      )}

      {/* Completed Sale Printable Receipt Modal */}
      {completedSaleId && <InvoiceReceiptModal saleId={completedSaleId} onClose={() => setCompletedSaleId(null)} />}
    </div>
  );
}

function PaymentModal({
  total, isProcessing, error, formatCurrency, onCancel, onConfirm,
}: {
  total: number;
  isProcessing: boolean;
  error: string;
  formatCurrency: (n: number) => string;
  onCancel: () => void;
  onConfirm: (method: PaymentMethod) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const cashRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const received = parseFloat(cashReceived);
  const hasReceived = method === "CASH" && cashReceived !== "" && !Number.isNaN(received);
  const shortBy = hasReceived ? round2(total - received) : 0;
  const change = hasReceived && shortBy <= 0 ? round2(received - total) : 0;
  const canConfirm = !isProcessing && shortBy <= 0;

  useEffect(() => {
    if (method === "CASH") cashRef.current?.focus();
    else confirmRef.current?.focus();
  }, [method]);

  // Keyboard: 1-4 pick a method, ←/→ cycle, Enter confirms, Esc cancels
  const handler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    handler.current = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (!isProcessing) onCancel();
      } else if (e.key === "Enter") {
        // A focused button handles Enter itself (Cancel must stay cancel)
        if ((e.target as HTMLElement).tagName === "BUTTON") return;
        e.preventDefault();
        if (canConfirm) onConfirm(method);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (isTyping(e.target) && (e.target as HTMLInputElement).value !== "") return;
        e.preventDefault();
        const i = PAYMENT_METHODS.findIndex((m) => m.value === method);
        const next = (i + (e.key === "ArrowRight" ? 1 : -1) + PAYMENT_METHODS.length) % PAYMENT_METHODS.length;
        setMethod(PAYMENT_METHODS[next].value);
      } else if (!isTyping(e.target)) {
        const picked = PAYMENT_METHODS.find((m) => m.key === e.key);
        if (picked) setMethod(picked.value);
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handler.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Complete payment" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Complete Payment</h3>
            <p className="text-xs text-slate-500">Keys 1–4 or ← → to choose, Enter to confirm</p>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(total)}</div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Payment Method</span>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Payment method">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon, key }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={method === value}
                  onClick={() => setMethod(value)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                    method === value ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs" : "border-slate-200 bg-white hover:border-emerald-300 text-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-600" aria-hidden /> {label}
                  <kbd className="text-[10px] font-mono text-slate-400">{key}</kbd>
                </button>
              ))}
            </div>
          </div>

          {method === "CASH" && (
            <div>
              <label htmlFor="cash-received" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cash received (optional)</label>
              <div className="flex gap-2">
                <input
                  id="cash-received"
                  ref={cashRef}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button type="button" onClick={() => setCashReceived(total.toFixed(2))} className="px-3 h-10 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer">
                  Exact
                </button>
              </div>
              {hasReceived && (
                <p className={`mt-2 text-sm font-extrabold ${shortBy > 0 ? "text-rose-600" : "text-emerald-700"}`} role="status">
                  {shortBy > 0 ? `Short by ${formatCurrency(shortBy)}` : `Change to return: ${formatCurrency(change)}`}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel <kbd className="ml-1 text-[10px] font-mono text-slate-400">Esc</kbd>
          </button>
          <button
            ref={confirmRef}
            onClick={() => onConfirm(method)}
            disabled={!canConfirm}
            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm transition-all shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Processing...
              </span>
            ) : (
              <>Confirm Sale <kbd className="ml-1.5 text-[10px] font-mono opacity-80">Enter</kbd></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
