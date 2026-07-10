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

const medicines = [
  { name: "Paracetamol 500mg", generic: "Paracetamol", brand: "Crocin", category: "Analgesic / Pain Relief", manufacturer: "GlaxoSmithKline (GSK)", strength: "500mg", form: "Tablet", uom: "Strip", size: 15, rx: false, min: 100, tax: 0 },
  { name: "Amoxicillin 500mg", generic: "Amoxicillin", brand: "Novamox", category: "Antibiotic", manufacturer: "Cipla", strength: "500mg", form: "Capsule", uom: "Strip", size: 10, rx: true, min: 50, tax: 0 },
  { name: "Pantoprazole 40mg", generic: "Pantoprazole", brand: "Pan 40", category: "Proton Pump Inhibitor (PPI)", manufacturer: "Alkem Laboratories", strength: "40mg", form: "Tablet", uom: "Strip", size: 15, rx: true, min: 100, tax: 0 },
  { name: "Cetirizine 10mg", generic: "Cetirizine", brand: "Cetzine", category: "Antihistamine / Allergy", manufacturer: "GlaxoSmithKline (GSK)", strength: "10mg", form: "Tablet", uom: "Strip", size: 10, rx: false, min: 100, tax: 0 },
  { name: "Amlodipine 5mg", generic: "Amlodipine", brand: "Amlokind", category: "Antihypertensive", manufacturer: "Mankind Pharma", strength: "5mg", form: "Tablet", uom: "Strip", size: 10, rx: true, min: 100, tax: 0 },
  { name: "Metformin 500mg", generic: "Metformin", brand: "Glycomet", category: "Diabetes / Antidiabetic", manufacturer: "USV", strength: "500mg", form: "Tablet", uom: "Strip", size: 10, rx: true, min: 100, tax: 0 },
  { name: "Vitamin C 500mg", generic: "Ascorbic Acid", brand: "Limcee", category: "Vitamin & Supplements", manufacturer: "Abbott", strength: "500mg", form: "Tablet", uom: "Strip", size: 15, rx: false, min: 100, tax: 5 },
  { name: "Benadryl Cough Syrup", generic: "Diphenhydramine", brand: "Benadryl", category: "Cough & Cold", manufacturer: "J&J", strength: "150ml", form: "Syrup", uom: "Bottle", size: 1, rx: false, min: 30, tax: 0 },
  { name: "Betnovate-C", generic: "Betamethasone + Clioquinol", brand: "Betnovate", category: "Dermatology / Skin Care", manufacturer: "GlaxoSmithKline (GSK)", strength: "30g", form: "Ointment", uom: "Tube", size: 1, rx: true, min: 20, tax: 0 },
  { name: "Fluconazole 150mg", generic: "Fluconazole", brand: "Fluka", category: "Antifungal", manufacturer: "Cipla", strength: "150mg", form: "Tablet", uom: "Strip", size: 1, rx: true, min: 20, tax: 0 },
  { name: "Alprazolam 0.25mg", generic: "Alprazolam", brand: "Alprax", category: "Anti Anxiety", manufacturer: "Torrent", strength: "0.25mg", form: "Tablet", uom: "Strip", size: 15, rx: true, min: 10, tax: 0 },
  { name: "Asthalin Inhaler", generic: "Salbutamol", brand: "Asthalin", category: "Bronchodilator", manufacturer: "Cipla", strength: "100mcg", form: "Inhaler", uom: "Piece", size: 1, rx: true, min: 30, tax: 0 },
  { name: "Meftal Spas", generic: "Mefenamic Acid", brand: "Meftal", category: "Analgesic / Pain Relief", manufacturer: "Blue Cross Laboratories", strength: "250mg", form: "Tablet", uom: "Strip", size: 10, rx: true, min: 50, tax: 0 },
  { name: "Refresh Tears", generic: "Carboxymethylcellulose", brand: "Refresh", category: "Eye Care / Ophthalmic", manufacturer: "Allergan", strength: "0.5%", form: "Drops", uom: "Bottle", size: 1, rx: false, min: 30, tax: 0 },
  { name: "Dettol Antiseptic", generic: "Chloroxylenol", brand: "Dettol", category: "Antiseptic / Disinfectant", manufacturer: "Reckitt", strength: "250ml", form: "Liquid", uom: "Bottle", size: 1, rx: false, min: 50, tax: 18 },
  { name: "Shelcal 500", generic: "Calcium + Vitamin D3", brand: "Shelcal", category: "Calcium Supplement", manufacturer: "Torrent", strength: "500mg", form: "Tablet", uom: "Strip", size: 15, rx: false, min: 80, tax: 5 },
  { name: "Telmisartan 40mg", generic: "Telmisartan", brand: "Telma", category: "Antihypertensive", manufacturer: "Glenmark Pharmaceuticals", strength: "40mg", form: "Tablet", uom: "Strip", size: 15, rx: true, min: 100, tax: 0 },
  { name: "Domperidone 10mg", generic: "Domperidone", brand: "Domstal", category: "Antiemetic", manufacturer: "Torrent", strength: "10mg", form: "Tablet", uom: "Strip", size: 15, rx: true, min: 30, tax: 0 },
  { name: "Azithromycin 500mg", generic: "Azithromycin", brand: "Azithral", category: "Antibiotic", manufacturer: "Alembic Pharmaceuticals", strength: "500mg", form: "Tablet", uom: "Strip", size: 5, rx: true, min: 50, tax: 0 },
  { name: "Combiflam", generic: "Ibuprofen + Paracetamol", brand: "Combiflam", category: "Analgesic / Pain Relief", manufacturer: "Sanofi", strength: "400mg/325mg", form: "Tablet", uom: "Strip", size: 20, rx: false, min: 100, tax: 0 }
];

async function seedProducts() {
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
    const productsCollection = db.collection("products");
    const categoriesCollection = db.collection("categories");
    const manufacturersCollection = db.collection("manufacturers");
    
    console.log(`Using Tenant ID: ${tenantId}. Preparing to insert ${medicines.length} products...`);

    let insertedCount = 0;
    let skippedCount = 0;
    let fallbackCatId = "";
    let fallbackMfrId = "";

    // Grab a fallback category and manufacturer just in case a precise match fails
    const defaultCat = await categoriesCollection.findOne({ tenant_id: tenantId });
    if (defaultCat) fallbackCatId = defaultCat._id.toString();
    
    const defaultMfr = await manufacturersCollection.findOne({ tenant_id: tenantId });
    if (defaultMfr) fallbackMfrId = defaultMfr._id.toString();

    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i];
      
      const existing = await productsCollection.findOne({ 
        tenant_id: tenantId, 
        name: med.name 
      });

      if (!existing) {
        // Resolve Category ID
        const cat = await categoriesCollection.findOne({ 
          tenant_id: tenantId, 
          name: new RegExp(`^${med.category.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') 
        });
        const resolvedCatId = cat ? cat._id.toString() : fallbackCatId;

        // Resolve Manufacturer ID
        const mfr = await manufacturersCollection.findOne({ 
          tenant_id: tenantId, 
          name: new RegExp(`^${med.manufacturer.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') 
        });
        const resolvedMfrId = mfr ? mfr._id.toString() : fallbackMfrId;

        await productsCollection.insertOne({
          tenant_id: tenantId,
          name: med.name,
          generic_name: med.generic,
          brand: med.brand,
          category_id: resolvedCatId,
          manufacturer_id: resolvedMfrId,
          barcode: `8901${Math.floor(10000000 + Math.random() * 90000000)}`, // Generates random 12 digit realistic EAN-like barcode
          dosage_form: med.form,
          strength: med.strength,
          unit_of_measure: med.uom,
          package_size: med.size,
          requires_prescription: med.rx,
          minimum_stock: med.min,
          tax_rate: med.tax,
          status: "ACTIVE",
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
    console.error("Failed to seed products:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB.");
  }
}

seedProducts();
