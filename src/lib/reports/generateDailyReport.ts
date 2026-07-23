import PDFDocument from 'pdfkit';
import client from "../mongodb";
import { format } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { ObjectId } from "mongodb";
import { getCurrencySymbol } from "@/lib/currency";

export interface DailyReportData {
  revenue: number;
  transactions: number;
  profit: number;
  refunds: number;
  topProducts: any[];
  inventoryAlerts: any[];
  date: Date;
  tenantName?: string;
  currencySymbol?: string;
}

export async function fetchDailyReportData(tenantId: string, date: Date, timezone: string): Promise<DailyReportData> {
  const db = client.db("pos");
  
  let tenantName = "Pharmacy POS";
  let currencySymbol = "$";

  if (tenantId) {
    const tenantIds: any[] = [tenantId];
    if (ObjectId.isValid(tenantId)) tenantIds.push(new ObjectId(tenantId));

    const tenantDoc = await db.collection("tenants").findOne({ _id: { $in: tenantIds } });
    if (tenantDoc) {
      tenantName = tenantDoc.business_name || tenantDoc.name || tenantName;
      if (tenantDoc.currency) {
        currencySymbol = getCurrencySymbol(tenantDoc.currency);
      }
    }
  }

  const tzDateStr = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
  const start = toDate(`${tzDateStr}T00:00:00.000`, { timeZone: timezone });
  const end = toDate(`${tzDateStr}T23:59:59.999`, { timeZone: timezone });

  // Fetch Sales for the day
  const sales = await db.collection("sales").find({
    tenant_id: tenantId,
    created_at: { $gte: start, $lte: end }
  }).toArray();

  let revenue = 0;
  let transactions = sales.length;
  let refunds = 0; 
  let profit = 0;

  const saleIds = sales.map(s => s._id.toString());
  
  const saleItems = await db.collection("sale_items").find({
    sale_id: { $in: saleIds }
  }).toArray();

  const productSalesMap = new Map<string, { name: string, qty: number, revenue: number }>();

  saleItems.forEach(item => {
    revenue += (item.price * item.qty) - (item.discount || 0);
    profit += item.profit || 0;

    const existing = productSalesMap.get(item.product_id) || { name: `Product ${item.product_id}`, qty: 0, revenue: 0 };
    existing.qty += item.qty;
    existing.revenue += (item.price * item.qty);
    productSalesMap.set(item.product_id, existing);
  });

  // Try to enrich product names
  const productIds = Array.from(productSalesMap.keys());
  if (productIds.length > 0) {
    const products = await db.collection("products").find({
      tenant_id: tenantId,
      _id: { $in: productIds.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id) as any[] }
    }).toArray();

    products.forEach(p => {
      const pId = p._id.toString();
      if (productSalesMap.has(pId)) {
        productSalesMap.get(pId)!.name = p.name;
      }
    });
  }

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Inventory Alerts
  const inventoryAlerts = await db.collection("products").aggregate([
    { $match: { tenant_id: tenantId, status: "ACTIVE" } },
    {
      $lookup: {
        from: "batches",
        let: { productId: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$product_id", "$$productId"] } } }
        ],
        as: "batches"
      }
    },
    {
      $addFields: {
        total_stock: { $sum: "$batches.qty_available" }
      }
    },
    {
      $match: {
        $expr: { $lte: ["$total_stock", { $ifNull: ["$minimum_stock", 0] }] }
      }
    },
    {
      $limit: 20
    }
  ]).toArray();

  if (revenue === 0 && sales.length > 0) {
    revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  }

  return {
    revenue,
    transactions,
    profit,
    refunds,
    topProducts,
    inventoryAlerts,
    date,
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
      const dateStr = format(data.date, 'EEEE, MMMM dd, yyyy');

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
        { label: 'TOTAL REVENUE', value: `${sym}${data.revenue.toFixed(2)}`, color: '#0F172A', bg: '#F8FAFC', border: '#E2E8F0' },
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
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(item.name.substring(0, 45), 75, curY + 5, { width: 260 });
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
