const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const client = new MongoClient("mongodb+srv://navnit_db_user:ypqb4zzehy@clinicemr.85aceo4.mongodb.net/pos");
  try {
    await client.connect();
    const db = client.db("pos");
    const sales = await db.collection("sales").find().limit(2).toArray();
    console.log("SALES:", JSON.stringify(sales, null, 2));
    
    const saleItems = await db.collection("sale_items").find().limit(2).toArray();
    console.log("SALE ITEMS:", JSON.stringify(saleItems, null, 2));

    const batches = await db.collection("batches").find().limit(2).toArray();
    console.log("BATCHES:", JSON.stringify(batches, null, 2));
    
    const products = await db.collection("products").find().limit(2).toArray();
    console.log("PRODUCTS:", JSON.stringify(products, null, 2));
    if (products.length > 0) {
      console.log("Is product _id an ObjectId?", products[0]._id instanceof ObjectId);
      console.log("Type of _id:", typeof products[0]._id);
    }
  } finally {
    await client.close();
  }
}
run();
