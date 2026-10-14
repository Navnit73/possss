import PDFDocument from 'pdfkit';
import client from "../mongodb";
import { addDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { resolveTimezone } from "@/lib/storeTime";
import { round2 } from "@/lib/posMath";
import { ObjectId } from "mongodb";
import { getCurrencySymbol } from "@/lib/currency";

export interface DailyReportData {
  /** Net sales: invoice amounts after line and bill discounts, excluding tax. */
  revenue: number;
  transactions: number;
  /** Net sales − cost of goods sold. */
  profit: number;
  refunds: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  inventoryAlerts: any[];
  date: Date;
  /** IANA timezone the report day is computed in. */
  timezone: string;
  /** The report day, "yyyy-MM-dd" in `timezone`. */
  dateStr: string;
  tenantName?: string;
  currencySymbol?: string;
}

export async function fetchDailyReportData(tenantId: string, date: Date, timezone: string): Promise<DailyReportData> {
  const db = client.db("pos");
  const tz = resolveTimezone(timezone);

  let tenantName = "Pharmacy POS";
  let currencySymbol = "$";

  if (tenantId && ObjectId.isValid(tenantId)) {
    const tenantDoc = await db.collection("tenants").findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { business_name: 1, name: 1, currency: 1 } }
    );
    if (tenantDoc) {
      tenantName = tenantDoc.business_name || tenantDoc.name || tenantName;
      if (tenantDoc.currency) {
        currencySymbol = getCurrencySymbol(tenantDoc.currency);
      }
    }
  }

  const tzDateStr = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  const start = fromZonedTime(`${tzDateStr}T00:00:00`, tz);
  const end = fromZonedTime(`${format(addDays(parseISO(tzDateStr), 1), 'yyyy-MM-dd')}T00:00:00`, tz);

  // Sales for the store day (only the fields needed)
  const sales = await db.collection("sales").find(
    { tenant_id: tenantId, created_at: { $gte: start, $lt: end } },
    { projection: { subtotal: 1, discount: 1, total: 1, tax: 1 } }
  ).toArray();

  const transactions = sales.length;
  const refunds = 0; // no returns flow exists yet
  let revenue = 0;
  let profit = 0;

  const saleIds = sales.map(s => s._id.toString());
  const saleItems = saleIds.length
    ? await db.collection("sale_items").find(
        // No tenant_id filter: legacy sale_items lack it, and saleIds come from this tenant's sales
        { sale_id: { $in: saleIds } },
        { projection: { sale_id: 1, product_id: 1, qty: 1, price: 1, discount: 1, cost_price: 1, profit: 1 } }
      ).toArray()
    : [];

  // Share of each line kept after the bill-level discount (same allocation as the P&L report)
  const billFactor = new Map<string, number>();
  for (const s of sales) {
    const subtotal = Number(s.subtotal) || 0;
    const discount = Number(s.discount) || 0;
    billFactor.set(s._id.toString(), subtotal > 0 ? Math.max(0, 1 - discount / subtotal) : 1);
  }

  const productSalesMap = new Map<string, { name: string, qty: number, revenue: number }>();

  saleItems.forEach(item => {
    const qty = Number(item.qty) || 0;
    // item.discount is a line percentage, not an amount
    const line = (Number(item.price) || 0) * qty * (1 - (Number(item.discount) || 0) / 100);
    const net = line * (billFactor.get(item.sale_id) ?? 1);
    const cogs = typeof item.cost_price === "number"
      ? item.cost_price * qty
      : typeof item.profit === "number" ? line - item.profit : 0;
    revenue += net;
    profit += net - cogs;

    const existing = productSalesMap.get(item.product_id) || { name: "Unknown product", qty: 0, revenue: 0 };
    existing.qty += qty;
    existing.revenue += net;
    productSalesMap.set(item.product_id, existing);
  });

  // Enrich product names
  const productIds = Array.from(productSalesMap.keys()).filter((id) => ObjectId.isValid(id));
  if (productIds.length > 0) {
    const products = await db.collection("products").find(
      { tenant_id: tenantId, _id: { $in: productIds.map(id => new ObjectId(id)) } },
      { projection: { name: 1 } }
    ).toArray();

    products.forEach(p => {
      const entry = productSalesMap.get(p._id.toString());
      if (entry) entry.name = p.name;
    });
  }

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map((p) => ({ ...p, revenue: round2(p.revenue) }));

  // Low stock — same rule as /api/inventory/low-stock and the dashboard: active products whose
  // sellable (non-expired, tenant-scoped) stock is at or below their minimum (missing minimum = 0).
  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const inventoryAlerts = await db.collection("products").aggregate([
    { $match: { tenant_id: tenantId, status: "ACTIVE" } },
    { $project: { name: 1, minimum_stock: 1, pid: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "batches",
        localField: "pid",
        foreignField: "product_id",
        pipeline: [
          {
            $match: {
              tenant_id: tenantId,
              qty_available: { $gt: 0 },
              $or: [{ expiry_date: { $exists: false } }, { expiry_date: null }, { expiry_date: "" }, { expiry_date: { $gte: today } }],
            },
          },
          { $project: { qty_available: 1 } },
        ],
        as: "batches"
      }
    },
    { $addFields: { total_stock: { $sum: "$batches.qty_available" } } },
    { $match: { $expr: { $lte: ["$total_stock", { $ifNull: ["$minimum_stock", 0] }] } } },
    { $project: { name: 1, minimum_stock: 1, total_stock: 1 } },
    { $sort: { total_stock: 1, name: 1 } },
    { $limit: 20 }
  ]).toArray();

  return {
    revenue: round2(revenue),
    transactions,
    profit: round2(profit),
    refunds,
    topProducts,
    inventoryAlerts,
    date,
    timezone: tz,
    dateStr: tzDateStr,
    tenantName,
    currencySymbol
  };
}

export async function generateDailyReportPdf(data: DailyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const sym = data.currencySymbol || "$";
      const storeTitle = data.tenantName || "Pharmacy POS";
      // The store's calendar day, not the server's
      const dateStr = formatInTimeZone(data.date, data.timezone, 'EEEE, MMMM dd, yyyy');

      // --- Header Banner ---
      doc.rect(40, 40, 515, 65).fill('#0F172A');

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#FFFFFF').text(storeTitle, 55, 52);
      doc.fontSize(11).font('Helvetica').fillColor('#94A3B8').text(`Daily Sales & Executive Digest • ${dateStr}`, 55, 76);

      // Top Right Badge
      doc.roundedRect(430, 52, 110, 22, 4).fill('#1E293B');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#10B981').text('DAILY DIGEST', 430, 58, { width: 110, align: 'center' });

      let curY = 125;

      // --- Executive KPI Summary Grid (4 Cards) ---
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Executive Performance Summary', 40, curY);
      curY += 20;

      const cardWidth = 120;
      const cardHeight = 55;
      const gap = 11;

      const kpis = [
        { label: 'NET SALES (EX. TAX)', value: `${sym}${data.revenue.toFixed(2)}`, color: '#0F172A', bg: '#F8FAFC', border: '#E2E8F0' },
        { label: 'GROSS PROFIT', value: `${sym}${data.profit.toFixed(2)}`, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
        { label: 'TRANSACTIONS', value: `${data.transactions}`, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
        { label: 'LOW STOCK ALERTS', value: `${data.inventoryAlerts.length}`, color: data.inventoryAlerts.length > 0 ? '#DC2626' : '#475569', bg: data.inventoryAlerts.length > 0 ? '#FEF2F2' : '#F8FAFC', border: data.inventoryAlerts.length > 0 ? '#FCA5A5' : '#E2E8F0' },
      ];

      kpis.forEach((kpi, idx) => {
        const x = 40 + idx * (cardWidth + gap);
        doc.rect(x, curY, cardWidth, cardHeight).fillAndStroke(kpi.bg, kpi.border);
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text(kpi.label, x + 8, curY + 10);
        doc.fontSize(13).font('Helvetica-Bold').fillColor(kpi.color).text(kpi.value, x + 8, curY + 26);
      });

      curY += cardHeight + 25;

      // --- Section 1: Top Products Sold ---
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Top Performing Products (by Qty)', 40, curY);
      curY += 18;

      if (!data.topProducts || data.topProducts.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748B').text('No product sales recorded for this date.', 40, curY);
        curY += 25;
      } else {
        // Table Header
        doc.rect(40, curY, 515, 22).fill('#1E293B');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('#', 48, curY + 6, { width: 25 });
        doc.text('Product Name', 75, curY + 6, { width: 260 });
        doc.text('Qty Sold', 345, curY + 6, { width: 80, align: 'right' });
        doc.text(`Revenue (${sym})`, 440, curY + 6, { width: 100, align: 'right' });

        curY += 22;

        data.topProducts.forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          doc.rect(40, curY, 515, 20).fillAndStroke(rowBg, '#E2E8F0');

          doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`${idx + 1}`, 48, curY + 5, { width: 25 });
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(String(item.name || 'Unknown product').substring(0, 45), 75, curY + 5, { width: 260 });
          doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(`${item.qty}`, 345, curY + 5, { width: 80, align: 'right' });
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#059669').text(`${sym}${item.revenue.toFixed(2)}`, 440, curY + 5, { width: 100, align: 'right' });

          curY += 20;
        });

        curY += 15;
      }

      // --- Section 2: Low Stock Alerts ---
      if (curY > 650) {
        doc.addPage();
        curY = 50;
      }

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Low Inventory & Reorder Alerts', 40, curY);
      curY += 18;

      if (!data.inventoryAlerts || data.inventoryAlerts.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#059669').text('✓ All inventory stock levels are healthy.', 40, curY);
        curY += 25;
      } else {
        // Table Header
        doc.rect(40, curY, 515, 22).fill('#991B1B');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('Product Name', 48, curY + 6, { width: 280 });
        doc.text('Current Stock', 345, curY + 6, { width: 90, align: 'right' });
        doc.text('Min Reorder Threshold', 445, curY + 6, { width: 95, align: 'right' });

        curY += 22;

        data.inventoryAlerts.forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#FEF2F2';
          doc.rect(40, curY, 515, 20).fillAndStroke(rowBg, '#FCA5A5');

          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text((item.name || 'Unnamed Product').substring(0, 48), 48, curY + 5, { width: 280 });
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#DC2626').text(`${item.total_stock || 0}`, 345, curY + 5, { width: 90, align: 'right' });
          doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`${item.minimum_stock || 0}`, 445, curY + 5, { width: 95, align: 'right' });

          curY += 20;
        });
      }

      // --- Footer ---
      const pageHeight = doc.page.height;
      doc.moveTo(40, pageHeight - 45).lineTo(555, pageHeight - 45).stroke('#E2E8F0');
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text(
        `${storeTitle} • Automated Executive Digest • Confidential`,
        40,
        pageHeight - 35,
        { align: 'center', width: 515 }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
