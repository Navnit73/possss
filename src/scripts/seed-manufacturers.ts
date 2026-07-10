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

const manufacturersList = [
  { name: "Cipla", contact_info: "Mumbai, Maharashtra" },
  { name: "Sun Pharma", contact_info: "Mumbai, Maharashtra" },
  { name: "Dr. Reddy's Laboratories", contact_info: "Hyderabad, Telangana" },
  { name: "Lupin", contact_info: "Mumbai, Maharashtra" },
  { name: "Aurobindo Pharma", contact_info: "Hyderabad, Telangana" },
  { name: "Torrent Pharmaceuticals", contact_info: "Ahmedabad, Gujarat" },
  { name: "Intas Pharmaceuticals", contact_info: "Ahmedabad, Gujarat" },
  { name: "Zydus Lifesciences", contact_info: "Ahmedabad, Gujarat" },
  { name: "Alkem Laboratories", contact_info: "Mumbai, Maharashtra" },
  { name: "Mankind Pharma", contact_info: "New Delhi" },
  { name: "Glenmark Pharmaceuticals", contact_info: "Mumbai, Maharashtra" },
  { name: "Macleods Pharmaceuticals", contact_info: "Mumbai, Maharashtra" },
  { name: "GlaxoSmithKline (GSK)", contact_info: "London, UK / Mumbai, India" },
  { name: "Abbott", contact_info: "Chicago, USA / Mumbai, India" },
  { name: "Pfizer", contact_info: "New York, USA / Mumbai, India" },
  { name: "Sanofi", contact_info: "Paris, France / Mumbai, India" },
  { name: "Novartis", contact_info: "Basel, Switzerland / Mumbai, India" },
  { name: "AstraZeneca", contact_info: "Cambridge, UK / Bengaluru, India" },
  { name: "Biocon", contact_info: "Bengaluru, Karnataka" },
  { name: "Micro Labs", contact_info: "Bengaluru, Karnataka" },
  { name: "Alembic Pharmaceuticals", contact_info: "Vadodara, Gujarat" },
  { name: "Ajanta Pharma", contact_info: "Mumbai, Maharashtra" },
  { name: "Emcure Pharmaceuticals", contact_info: "Pune, Maharashtra" },
  { name: "IPCA Laboratories", contact_info: "Mumbai, Maharashtra" },
  { name: "Natco Pharma", contact_info: "Hyderabad, Telangana" },
  { name: "Unichem Laboratories", contact_info: "Mumbai, Maharashtra" },
  { name: "Wockhardt", contact_info: "Mumbai, Maharashtra" },
  { name: "Hetero Drugs", contact_info: "Hyderabad, Telangana" },
  { name: "J.B. Chemicals & Pharmaceuticals", contact_info: "Mumbai, Maharashtra" },
  { name: "Panacea Biotec", contact_info: "New Delhi" },
  { name: "Divi's Laboratories", contact_info: "Hyderabad, Telangana" },
  { name: "Torrent", contact_info: "Ahmedabad, Gujarat" }, // Sometimes referred as just Torrent
  { name: "Apex Laboratories", contact_info: "Chennai, Tamil Nadu" },
  { name: "Blue Cross Laboratories", contact_info: "Mumbai, Maharashtra" },
  { name: "FDC Limited", contact_info: "Mumbai, Maharashtra" },
  { name: "Piramal Pharma", contact_info: "Mumbai, Maharashtra" },
  { name: "Reckitt", contact_info: "Slough, UK" },
  { name: "J&J", contact_info: "New Jersey, USA" },
  { name: "Win-Medicare", contact_info: "New Delhi" },
  { name: "Martin & Harris", contact_info: "New Delhi" },
  { name: "Centaur Pharmaceuticals", contact_info: "Mumbai, Maharashtra" },
  { name: "Allergan", contact_info: "Dublin, Ireland" },
  { name: "MSD", contact_info: "New Jersey, USA" },
  { name: "Bayer", contact_info: "Leverkusen, Germany" },
  { name: "P&G", contact_info: "Ohio, USA" },
  { name: "USV", contact_info: "Mumbai, Maharashtra" },
];

async function seedManufacturers() {
  try {
    await client.connect();
    const db = client.db("pos");
    console.log("Connected to MongoDB.");

    // Fetch the first available tenant
    const tenant = await db.collection("tenants").findOne({});
    if (!tenant) {
      console.error("❌ No tenant found in the database!");
      process.exit(1);
    }

    const tenantId = tenant._id.toString();
    const manufacturersCollection = db.collection("manufacturers");
    
    console.log(`Using Tenant ID: ${tenantId}. Preparing to insert ${manufacturersList.length} manufacturers...`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const mfr of manufacturersList) {
      const existing = await manufacturersCollection.findOne({ 
        tenant_id: tenantId, 
        name: mfr.name 
      });

      if (!existing) {
        await manufacturersCollection.insertOne({
          tenant_id: tenantId,
          name: mfr.name,
          contact_info: mfr.contact_info,
          created_at: new Date(),
          updated_at: new Date()
        });
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ Seeding Complete!`);
    console.log(`Inserted: ${insertedCount}`);
    console.log(`Skipped (already exists): ${skippedCount}`);

  } catch (error) {
    console.error("Failed to seed manufacturers:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB.");
  }
}

seedManufacturers();
