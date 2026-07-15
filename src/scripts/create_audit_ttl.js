const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("pos");
    const collection = db.collection("audit_logs");

    console.log("Creating TTL index on timestamp (365 days)...");
    
    // 365 days * 24 hours * 60 minutes * 60 seconds = 31536000 seconds
    const result = await collection.createIndex(
      { "timestamp": 1 },
      { expireAfterSeconds: 31536000 }
    );
    
    console.log("TTL Index Created:", result);
  } catch (error) {
    console.error("Error creating index:", error);
  } finally {
    await client.close();
  }
}

main();
