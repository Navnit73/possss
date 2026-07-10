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

async function clearDatabase() {
  try {
    await client.connect();
    const db = client.db();
    
    console.log("Connected to MongoDB. Clearing collections...");

    const collectionsToClear = [
      "users",
      "tenants",
      "categories",
      "manufacturers",
      "products",
      "inventory_batches",
      "inventory_movements",
      "sales",
      "suppliers"
    ];

    for (const collectionName of collectionsToClear) {
      const result = await db.collection(collectionName).deleteMany({});
      console.log(`Cleared ${result.deletedCount} documents from ${collectionName}`);
    }

    console.log("Database cleared successfully (All data wiped).");

  } catch (error) {
    console.error("Failed to clear database:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB.");
  }
}

clearDatabase();
