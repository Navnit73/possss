import { NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermissionAny } from "@/lib/rbac";
import { escapeRegExp } from "@/lib/utils";
import { getStoreToday, isExpired } from "@/lib/storeTime";

const MAX_RESULTS = 20;
const MAX_TOKENS = 6;
/** How many keyword matches are fetched before ranking (the top MAX_RESULTS of these are returned). */
const CANDIDATE_POOL = 150;

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermissionAny(session, [
      { module: "POS", action: "CREATE" },
      { module: "POS", action: "VIEW" },
      { module: "SALES", action: "CREATE" },
      { module: "SALES", action: "VIEW" },
    ]);
    if (permError) return permError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const query = (new URL(req.url).searchParams.get("q")?.trim() || "").slice(0, 100);
    const db = client.db("pos");

    const base = { tenant_id: tenantId, status: "ACTIVE" };
    const projection = {
      name: 1, generic_name: 1, brand: 1, barcode: 1, sku: 1, strength: 1, dosage_form: 1,
      rack_number: 1, active_ingredients: 1, requires_prescription: 1,
    };
    const products = db.collection("products");

    // A scanned barcode / SKU is an indexed exact lookup — and when it hits, the (much more expensive) keyword scan is skipped.
    const [today, exactMatches] = await Promise.all([
      getStoreToday(db, tenantId),
      query && !/\s/.test(query)
        ? products.find({ ...base, $or: [{ barcode: query }, { sku: query }] }, { projection }).limit(5).toArray()
        : [],
    ]);

    // Keywords: every word must match somewhere ("para 500" finds "Paracetamol 500mg").
    // Bounded to a candidate pool so a short query like "pa" can stop early instead of scanning the whole catalog.
    const keywordMatches = exactMatches.length > 0
      ? []
      : await products.find(
          query
            ? {
                ...base,
                $and: query.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS).map((token) => {
                  const re = { $regex: escapeRegExp(token), $options: "i" };
                  return { $or: [{ name: re }, { generic_name: re }, { brand: re }, { active_ingredients: re }, { strength: re }] };
                }),
              }
            : base,
          { projection, maxTimeMS: 3_000 }
        ).limit(CANDIDATE_POOL).toArray();

    // Best matches first: exact barcode/SKU > name starts with query > name contains > brand, then A–Z
    const lower = query.toLowerCase();
    const scoreOf = (p: any) => {
      if (!lower) return 0;
      const name = String(p.name ?? "").toLowerCase();
      return (
        (p.barcode?.toLowerCase() === lower || p.sku?.toLowerCase() === lower ? 100 : 0) +
        (name.startsWith(lower) ? 50 : 0) +
        (name.includes(lower) ? 20 : 0) +
        (String(p.brand ?? "").toLowerCase().includes(lower) ? 10 : 0)
      );
    };
    const unique = new Map<string, any>();
    for (const p of [...exactMatches, ...keywordMatches]) unique.set(p._id.toString(), p);
    const found = [...unique.values()]
      .map((p) => ({ p, score: scoreOf(p) }))
      .sort((a, b) => b.score - a.score || String(a.p.name).localeCompare(String(b.p.name)))
      .slice(0, MAX_RESULTS)
      .map(({ p }) => p);

    if (found.length === 0) return NextResponse.json([]);

    // One indexed query for all the products' stock (tenant_id + product_id + qty_available) instead of a $lookup per product.
    // cost_price is deliberately NOT returned: cashiers must not see what the store paid.
    const batches = await db.collection("batches")
      .find(
        { tenant_id: tenantId, product_id: { $in: found.map((p) => p._id.toString()) }, qty_available: { $gt: 0 } },
        { projection: { product_id: 1, batch_number: 1, qty_available: 1, selling_price: 1, expiry_date: 1, rack_number: 1 } }
      )
      .toArray();

    const byProduct = new Map<string, any[]>();
    for (const batch of batches) {
      const list = byProduct.get(batch.product_id) ?? [];
      list.push(batch);
      byProduct.set(batch.product_id, list);
    }

    const result = found.map((product) => {
      const all = byProduct.get(product._id.toString()) ?? [];
      const sellable = all
        .filter((b) => !isExpired(b.expiry_date, today))
        // First-expiry-first-out; batches without an expiry date go last (a plain string sort would put them first)
        .sort((a, b) => (a.expiry_date || "9999-12-31").localeCompare(b.expiry_date || "9999-12-31"))
        .map((b) => ({
          ...b,
          days_to_expiry: b.expiry_date ? differenceInCalendarDays(parseISO(b.expiry_date), parseISO(today)) : null,
        }));
      return { ...product, batches: sellable, expired_batches: all.length - sellable.length };
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/search");
  }
}
