const { MongoClient, ObjectId } = require("mongodb");

async function main() {
  const uri = "mongodb+srv://navnit_db_user:ypqb4zzehy@clinicemr.85aceo4.mongodb.net/pos";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("pos");
    const customers = await db.collection("customers").find().toArray();
    console.log("All Customers:");
    console.log(JSON.stringify(customers, null, 2));

    const id = "6a576537372dfeba1c65b766";
    if (ObjectId.isValid(id)) {
        const c = await db.collection("customers").findOne({ _id: new ObjectId(id) });
        console.log("Customer with that ID:");
        console.log(c);
    } else {
        console.log("ID is not valid ObjectId");
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
