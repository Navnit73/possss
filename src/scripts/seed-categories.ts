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

const categoriesList = [
  { name: "Analgesic / Pain Relief", description: "Medicines used to reduce pain such as headache, body pain, muscle pain, and fever-related pain." },
  { name: "Antipyretic", description: "Medicines mainly used to reduce fever and high body temperature." },
  { name: "Antibiotic", description: "Medicines used to treat bacterial infections by killing or stopping bacteria growth." },
  { name: "Antiviral", description: "Medicines used to treat infections caused by viruses." },
  { name: "Antifungal", description: "Medicines used for fungal infections of skin, mouth, or body." },
  { name: "Antiparasitic", description: "Medicines used against parasites, worms, and protozoal infections." },
  { name: "Anti-inflammatory", description: "Medicines that reduce swelling, inflammation, and pain." },
  { name: "Antihistamine / Allergy", description: "Medicines used for allergy symptoms like sneezing, itching, and runny nose." },
  { name: "Cough & Cold", description: "Medicines for cough, cold, congestion, sore throat, and flu symptoms." },
  { name: "Respiratory", description: "Medicines for asthma, COPD, breathing problems, and lung conditions." },
  { name: "Bronchodilator", description: "Medicines that open airways and improve breathing." },
  { name: "Antacid / Gastrointestinal", description: "Medicines for acidity, heartburn, indigestion, and stomach problems." },
  { name: "Proton Pump Inhibitor (PPI)", description: "Medicines that reduce stomach acid production." },
  { name: "Antiemetic", description: "Medicines used to prevent nausea and vomiting." },
  { name: "Antidiarrheal", description: "Medicines used to control diarrhea." },
  { name: "Laxative", description: "Medicines used to treat constipation." },
  { name: "Probiotic", description: "Products containing beneficial bacteria for digestive health." },
  { name: "Diabetes / Antidiabetic", description: "Medicines used to control blood sugar levels." },
  { name: "Insulin", description: "Injectable medicine used for diabetes management." },
  { name: "Cardiovascular", description: "Medicines related to heart and blood vessel diseases." },
  { name: "Antihypertensive", description: "Medicines used to control high blood pressure." },
  { name: "Cholesterol / Lipid Lowering", description: "Medicines used to reduce cholesterol levels." },
  { name: "Blood Thinner / Anticoagulant", description: "Medicines that reduce blood clot formation." },
  { name: "Diuretic", description: "Medicines that increase urine output and reduce fluid buildup." },
  { name: "Neurology", description: "Medicines used for nervous system disorders." },
  { name: "Antidepressant", description: "Medicines used for depression and mood disorders." },
  { name: "Anti Anxiety", description: "Medicines used for anxiety and related conditions." },
  { name: "Antipsychotic", description: "Medicines used for psychiatric disorders." },
  { name: "Antiepileptic", description: "Medicines used to prevent seizures." },
  { name: "Sleep Aid", description: "Medicines used for insomnia and sleep problems." },
  { name: "Hormonal Medicine", description: "Medicines affecting body hormone levels." },
  { name: "Thyroid Medicine", description: "Medicines for thyroid hormone disorders." },
  { name: "Steroid / Corticosteroid", description: "Medicines used for inflammation, allergies, and immune conditions." },
  { name: "Contraceptive", description: "Medicines/devices used for birth control." },
  { name: "Fertility Medicine", description: "Medicines used for fertility treatment." },
  { name: "Dermatology / Skin Care", description: "Medicines for skin diseases and infections." },
  { name: "Acne Treatment", description: "Medicines used for acne and related skin conditions." },
  { name: "Eye Care / Ophthalmic", description: "Eye drops and medicines for eye conditions." },
  { name: "Ear Care", description: "Ear drops and medicines for ear problems." },
  { name: "Dental / Oral Care", description: "Products for teeth, gums, and mouth health." },
  { name: "Vitamin & Supplements", description: "Vitamins, minerals, and nutritional supplements." },
  { name: "Calcium Supplement", description: "Calcium products for bone health." },
  { name: "Iron Supplement", description: "Iron medicines used for iron deficiency." },
  { name: "Protein & Nutrition", description: "Nutritional powders and health supplements." },
  { name: "Electrolytes", description: "Products used to restore body salts and hydration." },
  { name: "Vaccine", description: "Biological products used to prevent diseases." },
  { name: "Immunosuppressant", description: "Medicines that reduce immune system activity." },
  { name: "Oncology / Cancer", description: "Medicines used in cancer treatment." },
  { name: "Anesthetic", description: "Medicines used to reduce pain sensation during procedures." },
  { name: "Emergency Medicine", description: "Medicines used in emergency medical situations." },
  { name: "First Aid", description: "Bandages, antiseptics, and basic wound care items." },
  { name: "Antiseptic / Disinfectant", description: "Products used to kill germs on skin or surfaces." },
  { name: "Surgical Items", description: "Medical supplies like gloves, syringes, masks, etc." },
  { name: "Medical Devices", description: "Healthcare devices like BP monitor, thermometer, glucometer." },
  { name: "Baby Care", description: "Baby health products and medicines." },
  { name: "Women Health", description: "Products related to women's healthcare needs." },
  { name: "Men Health", description: "Products related to men's healthcare needs." },
  { name: "Herbal / Ayurvedic", description: "Herbal and traditional medicine products." },
  { name: "Homeopathic", description: "Homeopathic medicine category." },
  { name: "Personal Care", description: "Hygiene and personal health products." },
  { name: "Diagnostic Products", description: "Test kits and monitoring products." },
  { name: "Injection", description: "Injectable medicines and related products." },
  { name: "IV Fluids", description: "Intravenous fluids used for hydration and treatment." },
  { name: "Controlled Drugs", description: "Regulated medicines requiring special tracking and authorization." },
  { name: "OTC Medicine", description: "Medicines available without prescription." },
  { name: "Prescription Medicine", description: "Medicines requiring doctor's prescription." },
  { name: "Miscellaneous", description: "Other pharmacy products not fitting specific categories." },
];

async function seedCategories() {
  try {
    await client.connect();
    const db = client.db("pos");
    console.log("Connected to MongoDB.");

    // Fetch the first available tenant since this is for local dev
    const tenant = await db.collection("tenants").findOne({});
    if (!tenant) {
      console.error("❌ No tenant found in the database!");
      console.error("Please open the app and register a new user/tenant first, then run this script again.");
      process.exit(1);
    }

    const tenantId = tenant._id.toString();
    const categoriesCollection = db.collection("categories");
    
    console.log(`Using Tenant ID: ${tenantId}. Preparing to insert ${categoriesList.length} categories...`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const cat of categoriesList) {
      const existing = await categoriesCollection.findOne({ 
        tenant_id: tenantId, 
        name: cat.name 
      });

      if (!existing) {
        await categoriesCollection.insertOne({
          tenant_id: tenantId,
          name: cat.name,
          description: cat.description,
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
    console.error("Failed to seed categories:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB.");
  }
}

seedCategories();
