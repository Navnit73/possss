// Shared building blocks for the /api/reports/* routes: store-timezone date ranges, safe query-param
// parsing, and one definition of line revenue / COGS / profit so every report agrees.
import { Db, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { addDays, differenceInCalendarDays, endOfMonth, format, isValid, parseISO, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { resolveTimezone } from "@/lib/storeTime";

/** The store's own IANA timezone (tenants.timezone), falling back to UTC. */
export async function getStoreTimezone(db: Db, tenantId: string): Promise<string> {
  const tenant = ObjectId.isValid(tenantId)
    ? await db.collection("tenants").findOne({ _id: new ObjectId(tenantId) }, { projection: { timezone: 1 } })
    : null;
  return resolveTimezone(tenant?.timezone);
}

/** A bad query parameter: reported to the client as a 400 with this message. */
export class ReportParamError extends Error {}

export function reportParamErrorResponse(error: unknown): NextResponse | null {
  return error instanceof ReportParamError ? NextResponse.json({ error: error.message }, { status: 400 }) : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const MAX_PAGE_SIZE = 100;
/** Hard cap on rows returned by an export so one request can't pull an unbounded result set into memory. */
export const MAX_EXPORT_ROWS = 10000;

const shiftDay = (dateStr: string, days: number) => format(addDays(parseISO(dateStr), days), "yyyy-MM-dd");

export interface ReportRange {
  tz: string;
  fromStr: string;
  toStr: string;
  /** Inclusive start instant (store-local midnight of fromStr). */
  start: Date;
  /** Exclusive end instant (store-local midnight of the day after toStr). */
  end: Date;
  days: number;
}

/** Resolves the dateRange / startDate / endDate params as calendar days in the store's timezone. */
export function resolveReportRange(params: URLSearchParams, tz: string, defaultRange = "30days"): ReportRange {
  const dateRange = params.get("dateRange") || defaultRange;
  const todayStr = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const today = parseISO(todayStr);
  let fromStr: string;
  let toStr: string;

  if (dateRange === "custom") {
    const s = params.get("startDate") || "";
    const e = params.get("endDate") || "";
    if (
      !DATE_RE.test(s) || !DATE_RE.test(e) || !isValid(parseISO(s)) || !isValid(parseISO(e)) || s > e
      || differenceInCalendarDays(parseISO(e), parseISO(s)) >= MAX_RANGE_DAYS
    ) {
      throw new ReportParamError(`Choose a valid date range of up to ${MAX_RANGE_DAYS} days.`);
    }
    fromStr = s;
    toStr = e;
  } else {
    switch (dateRange) {
      case "today": fromStr = toStr = todayStr; break;
      case "yesterday": fromStr = toStr = shiftDay(todayStr, -1); break;
      case "7days": fromStr = shiftDay(todayStr, -6); toStr = todayStr; break;
      case "thisMonth": fromStr = format(startOfMonth(today), "yyyy-MM-dd"); toStr = format(endOfMonth(today), "yyyy-MM-dd"); break;
      case "lastMonth": fromStr = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"); toStr = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd"); break;
      case "30days":
      default: fromStr = shiftDay(todayStr, -29); toStr = todayStr; break;
    }
  }

  return {
    tz,
    fromStr,
    toStr,
    start: fromZonedTime(`${fromStr}T00:00:00`, tz),
    end: fromZonedTime(`${shiftDay(toStr, 1)}T00:00:00`, tz),
    days: differenceInCalendarDays(parseISO(toStr), parseISO(fromStr)) + 1,
  };
}

/** Calendar days of a range, inclusive — for zero-filling daily charts. */
export function eachDay(fromStr: string, toStr: string): string[] {
  const out: string[] = [];
  for (let d = fromStr; d <= toStr; d = shiftDay(d, 1)) out.push(d);
  return out;
}

export function parsePagination(params: URLSearchParams) {
  const rawPage = parseInt(params.get("page") || "1", 10);
  const rawLimit = parseInt(params.get("limit") || "20", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : 20;
  return { page, limit, skip: (page - 1) * limit, isExport: params.get("export") === "true" };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Trimmed search text, length-capped, escaped for use inside a RegExp. */
export function parseSearch(params: URLSearchParams, key = "search"): string {
  const raw = (params.get(key) || "").trim().slice(0, 100);
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Joins a product (tenant-scoped, by _id index) onto `product`. `idPath` is the string product id, e.g. "$items.product_id". */
export function productLookupStages(tenantId: string, idPath: string, fields: string[] = ["name", "generic_name", "category_id", "rack_number"]) {
  return [
    { $addFields: { _pid: { $convert: { input: idPath, to: "objectId", onError: null, onNull: null } } } },
    {
      $lookup: {
        from: "products",
        localField: "_pid",
        foreignField: "_id",
        pipeline: [
          { $match: { tenant_id: tenantId } },
          { $project: Object.fromEntries(fields.map((f) => [f, 1])) },
        ],
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  ];
}

/** Joins the product's category (tenant-scoped) onto `category_doc`. Requires `product` from productLookupStages. */
export function categoryLookupStages(tenantId: string) {
  return [
    { $addFields: { _cid: { $convert: { input: "$product.category_id", to: "objectId", onError: null, onNull: null } } } },
    {
      $lookup: {
        from: "categories",
        localField: "_cid",
        foreignField: "_id",
        pipeline: [{ $match: { tenant_id: tenantId } }, { $project: { name: 1 } }],
        as: "category_doc",
      },
    },
    { $unwind: { path: "$category_doc", preserveNullAndEmptyArrays: true } },
  ];
}

/**
 * From a `sales` match, joins each sale's line items (indexed on sale_id, tenant-scoped), unwinds one row per line
 * and adds the money fields every report uses:
 *  - line_gross:   price × qty, before any discount
 *  - line_amount:  after the line % discount (what the POS bills as the line)
 *  - line_net:     line_amount with the bill-level discount allocated pro-rata (subtotal is the sum of line_amounts).
 *                  Tax is never revenue, so it is excluded.
 *  - line_cogs:    cost_price × qty; legacy items without cost_price fall back to line_amount − stored profit.
 *  - line_profit:  line_net − line_cogs (stored item.profit ignores the bill discount, so it isn't used directly).
 */
export function saleLineStages(tenantId: string, itemFields: string[] = []) {
  const itemProjection: Record<string, 1 | 0> = { _id: 1, product_id: 1, batch_id: 1, qty: 1, price: 1, cost_price: 1, discount: 1, profit: 1 };
  for (const f of itemFields) itemProjection[f] = 1;
  const qty = { $ifNull: ["$items.qty", 0] };
  const price = { $ifNull: ["$items.price", 0] };
  const lineGross = { $multiply: [price, qty] };
  const lineAmount = { $multiply: [lineGross, { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }] };
  return [
    { $addFields: { _sid: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "sale_items",
        localField: "_sid",
        foreignField: "sale_id",
        pipeline: [{ $project: itemProjection }], // no tenant_id match: legacy sale_items lack it; parent sale is tenant-matched
        as: "items",
      },
    },
    { $unwind: "$items" },
    {
      $addFields: {
        line_gross: lineGross,
        line_amount: lineAmount,
        _bill_factor: {
          $cond: [
            { $gt: [{ $ifNull: ["$subtotal", 0] }, 0] },
            { $max: [0, { $subtract: [1, { $divide: [{ $ifNull: ["$discount", 0] }, "$subtotal"] }] }] },
            1,
          ],
        },
      },
    },
    {
      $addFields: {
        line_net: { $multiply: ["$line_amount", "$_bill_factor"] },
        line_cogs: {
          $cond: [
            { $isNumber: "$items.cost_price" },
            { $multiply: ["$items.cost_price", qty] },
            { $cond: [{ $isNumber: "$items.profit" }, { $subtract: ["$line_amount", "$items.profit"] }, 0] },
          ],
        },
      },
    },
    { $addFields: { line_profit: { $subtract: ["$line_net", "$line_cogs"] } } },
  ];
}

export function round2(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Margin as a percentage of revenue; 0 when there is no revenue (never NaN / Infinity). */
export function marginPct(profit: number, revenue: number): number {
  return revenue > 0 ? round2((profit / revenue) * 100) : 0;
}

/** Hour labels for a rush-hours chart: 8 AM–10 PM by default, widened so early/late sales aren't dropped. */
export function hourlySeries(rows: Array<{ _id: number; revenue: number; orders?: number }>) {
  const map = new Map(rows.map((r) => [r._id, r]));
  const sold = [...map.keys()];
  const first = Math.min(8, ...sold);
  const last = Math.max(22, ...sold);
  const out = [];
  for (let h = first; h <= last; h++) {
    const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
    out.push({ hour: label, revenue: round2(map.get(h)?.revenue || 0), orders: map.get(h)?.orders || 0 });
  }
  return out;
}
