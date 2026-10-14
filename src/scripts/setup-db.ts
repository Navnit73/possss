import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function setupIndexes() {
  try {
    await client.connect();
    const db = client.db("pos");

    console.log("Setting up MongoDB indexes...");

    // A unique index can fail on existing duplicate data; report it and keep creating the rest
    const failures: string[] = [];
    const ensure = async (name: string, spec: Record<string, 1 | -1>, options: Record<string, unknown> = {}) => {
      try {
        await db.collection(name).createIndex(spec, options);
      } catch (err: any) {
        failures.push(`${name} ${JSON.stringify(spec)}: ${err?.message}`);
      }
    };

    // 1. Users collection
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    
    // 2. Tenants collection
    // No specific large-scale queries other than by _id

    // 3. Categories collection
    await db.collection("categories").createIndex({ tenant_id: 1 });
    await db.collection("categories").createIndex({ tenant_id: 1, name: 1 }, { unique: true });

    // 4. Manufacturers collection
    await db.collection("manufacturers").createIndex({ tenant_id: 1 });
    await db.collection("manufacturers").createIndex({ tenant_id: 1, name: 1 }, { unique: true });

    // 5. Products collection
    await db.collection("products").createIndex({ tenant_id: 1 });
    await db.collection("products").createIndex({ tenant_id: 1, status: 1 });
    // Exact SKU lookups at the POS
    await db.collection("products").createIndex({ tenant_id: 1, sku: 1 }, { partialFilterExpression: { sku: { $type: "string" } } });
    await db.collection("products").createIndex({ tenant_id: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });
    // Inventory-value category filter
    await ensure("products", { tenant_id: 1, category_id: 1 });
    
    // Drop existing text index if it has different definition before creating new one (safeguard)
    try {
        await db.collection("products").dropIndex("name_text_generic_name_text_barcode_text_sku_text");
    } catch { /* ignore if not exists */ }

    // 6. Batches collection
    await db.collection("batches").createIndex({ tenant_id: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, product_id: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, expiry_date: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, qty_available: 1, expiry_date: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, product_id: 1, qty_available: 1, expiry_date: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, product_id: 1, batch_number: 1 }, { unique: true });
    // Sorted batch list / supplier purchase history
    await ensure("batches", { tenant_id: 1, created_at: -1 });
    await ensure("batches", { tenant_id: 1, supplier_id: 1 });

    // 7. Suppliers collection
    await db.collection("suppliers").createIndex({ tenant_id: 1 });
    await db.collection("suppliers").createIndex({ tenant_id: 1, name: 1 }, { unique: true });

    // 8. Sales collection
    await db.collection("sales").createIndex({ tenant_id: 1 });
    await db.collection("sales").createIndex({ tenant_id: 1, invoice_no: 1 }, { unique: true });
    await db.collection("sales").createIndex({ tenant_id: 1, created_at: -1 });
    // A retried checkout must never create a second sale
    await db.collection("sales").createIndex({ tenant_id: 1, idempotency_key: 1 }, { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } });
    // Customer profile purchase history / delete check
    await ensure("sales", { tenant_id: 1, customer_id: 1, created_at: -1 });

    // 9. Sale Items collection
    await db.collection("sale_items").createIndex({ sale_id: 1 });
    await db.collection("sale_items").createIndex({ product_id: 1 });
    await db.collection("sale_items").createIndex({ tenant_id: 1, sale_id: 1 });
    await ensure("sale_items", { tenant_id: 1, product_id: 1 });

    // 10. Stock Movements collection
    await db.collection("stock_movements").createIndex({ tenant_id: 1 });
    await db.collection("stock_movements").createIndex({ tenant_id: 1, product_id: 1 });
    await db.collection("stock_movements").createIndex({ tenant_id: 1, created_at: -1 });
    await ensure("stock_movements", { tenant_id: 1, movement_type: 1, created_at: -1 });
    await ensure("stock_movements", { tenant_id: 1, batch_id: 1 });

    // 11. Customers and distributed rate limiting
    await db.collection("customers").createIndex({ tenant_id: 1, created_at: -1 });
    await db.collection("customers").createIndex({ tenant_id: 1, phone: 1 });
    await db.collection("customers").createIndex({ tenant_id: 1, status: 1 });
    // Customer numbers are unique per store (closes the check-then-insert race for custom ids)
    await ensure("customers", { tenant_id: 1, customer_id: 1 }, { unique: true, partialFilterExpression: { customer_id: { $type: "string" } } });
    await db.collection("rate_limits").createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });

    // 12. Audit Logs collection
    await db.collection("audit_logs").createIndex({ tenant_id: 1, timestamp: -1 });
    await db.collection("audit_logs").createIndex({ tenant_id: 1, action: 1, timestamp: -1 });
    await db.collection("audit_logs").createIndex({ tenant_id: 1, module: 1, timestamp: -1 });
    await ensure("audit_logs", { tenant_id: 1, user_id: 1, timestamp: -1 });

    // Scheduled reports
    await ensure("settings", { tenant_id: 1 });
    await ensure("settings", { "reports.enabled": 1 });
    await ensure("email_logs", { tenant_id: 1, reportType: 1, date: 1, status: 1 });
    await ensure("email_logs", { tenant_id: 1, sentAt: -1 });

    // Legacy/application logs (logAction) are keyed by tenantId
    await db.collection("logs").createIndex({ tenantId: 1, timestamp: -1 });

    // Billing
    await db.collection("payments").createIndex({ tenant_id: 1, created_at: -1 });
    await db.collection("payments").createIndex({ razorpay_payment_id: 1 }, { unique: true, partialFilterExpression: { razorpay_payment_id: { $type: "string" } } });
    await db.collection("tenants").createIndex({ "subscription.id": 1 }, { sparse: true });
    await db.collection("tenants").createIndex({ "subscription_checkout.id": 1 }, { sparse: true });
    // Webhook de-duplication ids only need to live as long as Razorpay retries (days)
    await db.collection("webhook_events").createIndex({ created_at: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

    if (failures.length) {
      console.warn(`Some indexes could not be created (fix the data, then re-run):\n  ${failures.join("\n  ")}`);
    }
    console.log("MongoDB indexes setup completed.");
  } catch (error) {
    console.error("Error setting up indexes:", error);
  } finally {
    await client.close();
  }
}

setupIndexes();
