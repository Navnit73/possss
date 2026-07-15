import PDFDocument from 'pdfkit';
import client from "../mongodb";
import { format, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';

export interface DailyReportData {
  revenue: number;
  transactions: number;
  profit: number;
  refunds: number;
  topProducts: any[];
  inventoryAlerts: any[];
  date: Date;
}

export async function fetchDailyReportData(tenantId: string, date: Date, timezone: string): Promise<DailyReportData> {
  const db = client.db("pos");
  
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
  // TODO: Add refund logic if a refund collection/status exists. Assuming 0 for now.
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
      _id: { $in: productIds.map(id => {
        try { return new (require('mongodb').ObjectId)(id); } catch (e) { return id; }
      }) }
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

  // If revenue wasn't aggregated correctly from items, fallback to sales totals
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
    date
  };
}

export async function generateDailyReportPdf(data: DailyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Header
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#0f172a').text('Daily Sales Report', { align: 'center' });
      doc.fontSize(12).font('Helvetica').fillColor('#64748b').text(`Date: ${format(data.date, 'MMMM dd, yyyy')}`, { align: 'center' });
      doc.moveDown(2);

      // Summary Cards (Text format)
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('Executive Summary');
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica').fillColor('#334155');
      doc.text(`Total Revenue: $${data.revenue.toFixed(2)}`);
      doc.text(`Total Profit: $${data.profit.toFixed(2)}`);
      doc.text(`Transactions: ${data.transactions}`);
      doc.text(`Refunds: $${data.refunds.toFixed(2)}`);
      doc.moveDown(2);

      // Top Products Table
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('Top Products (by Quantity)');
      doc.moveDown(0.5);
      
      if (data.topProducts.length === 0) {
        doc.fontSize(12).font('Helvetica-Oblique').fillColor('#64748b').text('No products sold today.');
      } else {
        const tableTop = doc.y;
        let y = tableTop;
        
        // Headers
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Product Name', 50, y);
        doc.text('Qty Sold', 350, y, { width: 90, align: 'right' });
        doc.text('Revenue', 450, y, { width: 90, align: 'right' });
        
        y += 20;
        doc.moveTo(50, y - 5).lineTo(540, y - 5).stroke('#cbd5e1');

        doc.font('Helvetica').fillColor('#334155');
        for (const item of data.topProducts) {
          doc.text(item.name.substring(0, 40), 50, y);
          doc.text(item.qty.toString(), 350, y, { width: 90, align: 'right' });
          doc.text(`$${item.revenue.toFixed(2)}`, 450, y, { width: 90, align: 'right' });
          y += 20;
        }
      }
      doc.moveDown(2);

      // Inventory Alerts
      // We manually move y below the table
      doc.y = Math.max(doc.y, 400); // rough estimate just in case
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('Low Inventory Alerts', 50, doc.y);
      doc.moveDown(0.5);

      if (data.inventoryAlerts.length === 0) {
        doc.fontSize(12).font('Helvetica-Oblique').fillColor('#64748b').text('No low stock alerts today.');
      } else {
        const alertTableTop = doc.y;
        let yAlert = alertTableTop;
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Product Name', 50, yAlert);
        doc.text('Stock Level', 350, yAlert, { width: 90, align: 'right' });
        doc.text('Min Required', 450, yAlert, { width: 90, align: 'right' });
        
        yAlert += 20;
        doc.moveTo(50, yAlert - 5).lineTo(540, yAlert - 5).stroke('#cbd5e1');

        doc.font('Helvetica').fillColor('#334155');
        for (const item of data.inventoryAlerts) {
          doc.text(item.name.substring(0, 40), 50, yAlert);
          doc.fillColor('#ef4444').text((item.total_stock || 0).toString(), 350, yAlert, { width: 90, align: 'right' });
          doc.fillColor('#334155').text((item.minimum_stock || 0).toString(), 450, yAlert, { width: 90, align: 'right' });
          yAlert += 20;
        }
      }

      // Footer
      doc.fontSize(10).font('Helvetica').fillColor('#94a3b8').text(
        'Generated automatically by Pharmacy POS',
        50,
        doc.page.height - 50,
        { align: 'center', lineBreak: false }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
