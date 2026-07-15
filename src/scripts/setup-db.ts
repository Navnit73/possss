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
    await db.collection("products").createIndex({ tenant_id: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });
    
    // Drop existing text index if it has different definition before creating new one (safeguard)
    try {
        await db.collection("products").dropIndex("name_text_generic_name_text_barcode_text_sku_text");
    } catch (e) { /* ignore if not exists */ }

    // 6. Batches collection
    await db.collection("batches").createIndex({ tenant_id: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, product_id: 1 });
    await db.collection("batches").createIndex({ tenant_id: 1, expiry_date: 1 });

    // 7. Suppliers collection
    await db.collection("suppliers").createIndex({ tenant_id: 1 });
    await db.collection("suppliers").createIndex({ tenant_id: 1, name: 1 }, { unique: true });

    // 8. Sales collection
    await db.collection("sales").createIndex({ tenant_id: 1 });
    await db.collection("sales").createIndex({ tenant_id: 1, invoice_no: 1 }, { unique: true });
    await db.collection("sales").createIndex({ tenant_id: 1, created_at: -1 });

    // 9. Sale Items collection
    await db.collection("sale_items").createIndex({ sale_id: 1 });
    await db.collection("sale_items").createIndex({ product_id: 1 });

    // 10. Stock Movements collection
    await db.collection("stock_movements").createIndex({ tenant_id: 1 });
    await db.collection("stock_movements").createIndex({ tenant_id: 1, product_id: 1 });
    await db.collection("stock_movements").createIndex({ tenant_id: 1, created_at: -1 });

    // 11. Audit Logs collection
    await db.collection("audit_logs").createIndex({ tenant_id: 1, timestamp: -1 });
    await db.collection("audit_logs").createIndex({ tenant_id: 1, action: 1, timestamp: -1 });
    await db.collection("audit_logs").createIndex({ tenant_id: 1, module: 1, timestamp: -1 });

    console.log("MongoDB indexes setup completed successfully.");
  } catch (error) {
    console.error("Error setting up indexes:", error);
  } finally {
    await client.close();
  }
}

setupIndexes();
