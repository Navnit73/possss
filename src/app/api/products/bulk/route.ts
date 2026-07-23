import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { productSchema } from "@/lib/validations";

export const POST = withAuditLog("BULK_CREATE_PRODUCTS", "PRODUCTS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "Invalid payload. Expected a non-empty array of products." }, { status: 400 });
    }

    const db = client.db("pos");
    const productsCollection = db.collection("products");
    const categoriesCollection = db.collection("categories");
    const manufacturersCollection = db.collection("manufacturers");

    // 1. Extract unique categories and manufacturers from payload
    const categoryNames = [...new Set(body.map((item: any) => item.category_name?.trim()).filter(Boolean))];
    const manufacturerNames = [...new Set(body.map((item: any) => item.manufacturer_name?.trim()).filter(Boolean))];

    if (categoryNames.length === 0 || manufacturerNames.length === 0) {
      return NextResponse.json({ error: "Each product must have a category_name and manufacturer_name." }, { status: 400 });
    }

    // 2. Lookup existing categories and manufacturers
    const existingCategories = await categoriesCollection.find({
      tenant_id: tenantId,
      name: { $in: categoryNames.map(n => new RegExp(`^${n}$`, 'i')) }
    }).toArray();

    const existingManufacturers = await manufacturersCollection.find({
      tenant_id: tenantId,
      name: { $in: manufacturerNames.map(n => new RegExp(`^${n}$`, 'i')) }
    }).toArray();

    // Maps for quick lookup (lowercase name to ID string)
    const catMap = new Map<string, string>();
    existingCategories.forEach(c => catMap.set(c.name.toLowerCase(), c._id.toString()));

    const mfgMap = new Map<string, string>();
    existingManufacturers.forEach(m => mfgMap.set(m.name.toLowerCase(), m._id.toString()));

    // 3. Create missing categories
    const newCategories = categoryNames.filter(n => !catMap.has(n.toLowerCase()));
    if (newCategories.length > 0) {
      const catDocs = newCategories.map(name => ({
        tenant_id: tenantId,
        name,
        created_at: new Date()
      }));
      const result = await categoriesCollection.insertMany(catDocs);
      Object.entries(result.insertedIds).forEach(([index, id], idx) => {
        catMap.set(catDocs[idx].name.toLowerCase(), id.toString());
      });
    }

    // 4. Create missing manufacturers
    const newManufacturers = manufacturerNames.filter(n => !mfgMap.has(n.toLowerCase()));
    if (newManufacturers.length > 0) {
      const mfgDocs = newManufacturers.map(name => ({
        tenant_id: tenantId,
        name,
        created_at: new Date()
      }));
      const result = await manufacturersCollection.insertMany(mfgDocs);
      Object.entries(result.insertedIds).forEach(([index, id], idx) => {
        mfgMap.set(mfgDocs[idx].name.toLowerCase(), id.toString());
      });
    }

    // 5. Fetch all existing barcodes to prevent duplicates
    const incomingBarcodes = body.map((item: any) => item.barcode).filter(Boolean);
    let existingBarcodesSet = new Set<string>();
    
    if (incomingBarcodes.length > 0) {
      const existingWithBarcodes = await productsCollection.find({
        tenant_id: tenantId,
        barcode: { $in: incomingBarcodes }
      }).toArray();
      existingBarcodesSet = new Set(existingWithBarcodes.map(p => p.barcode));
    }

    // 6. Map and validate products
    const productsToInsert = [];
    const errors = [];
    const currentDate = new Date();

    for (let i = 0; i < body.length; i++) {
      const rawItem = body[i];
      const rowNum = i + 2; // Assuming row 1 is header

      const catName = rawItem.category_name?.trim();
      const mfgName = rawItem.manufacturer_name?.trim();

      if (!catName || !mfgName) {
        errors.push(`Row ${rowNum}: category_name and manufacturer_name are required.`);
        continue;
      }

      const category_id = catMap.get(catName.toLowerCase());
      const manufacturer_id = mfgMap.get(mfgName.toLowerCase());

      if (!category_id || !manufacturer_id) {
        errors.push(`Row ${rowNum}: Failed to resolve category or manufacturer.`);
        continue;
      }

      if (rawItem.barcode && existingBarcodesSet.has(rawItem.barcode)) {
        errors.push(`Row ${rowNum}: Barcode '${rawItem.barcode}' already exists in database.`);
        continue;
      }

      // Check for duplicates within the current payload
      if (rawItem.barcode) {
        const payloadDups = body.filter((item: any, idx: number) => item.barcode === rawItem.barcode && idx !== i);
        if (payloadDups.length > 0) {
          errors.push(`Row ${rowNum}: Barcode '${rawItem.barcode}' is duplicated in the uploaded file.`);
          continue;
        }
      }

      const itemToValidate = {
        ...rawItem,
        category_id,
        manufacturer_id,
        // Ensure coercable fields are passed safely
        package_size: rawItem.package_size ? Number(rawItem.package_size) : undefined,
        minimum_stock: rawItem.minimum_stock ? Number(rawItem.minimum_stock) : undefined,
        tax_rate: rawItem.tax_rate ? Number(rawItem.tax_rate) : undefined,
        requires_prescription: typeof rawItem.requires_prescription === 'string' 
            ? rawItem.requires_prescription.toLowerCase() === 'true' 
            : Boolean(rawItem.requires_prescription)
      };

      try {
        const validatedData = productSchema.parse(itemToValidate);
        productsToInsert.push({
          ...validatedData,
          tenant_id: tenantId,
          created_at: currentDate,
        });
      } catch (err: any) {
        if (err.errors) {
          err.errors.forEach((e: any) => {
            errors.push(`Row ${rowNum} [${e.path.join(".")}]: ${e.message}`);
          });
        } else {
          errors.push(`Row ${rowNum}: Invalid data.`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: "Validation failed for some items.", 
        details: errors.slice(0, 50) // Return top 50 errors max to prevent huge response
      }, { status: 400 });
    }

    if (productsToInsert.length === 0) {
      return NextResponse.json({ error: "No valid products found to insert." }, { status: 400 });
    }

    // 7. Bulk insert
    const result = await productsCollection.insertMany(productsToInsert);

    audit.setAfter({
      bulk_count: result.insertedCount,
      insertedIds: result.insertedIds
    });

    return NextResponse.json({ 
      message: `Successfully uploaded ${result.insertedCount} products.`,
      count: result.insertedCount 
    }, { status: 201 });

  } catch (error: any) {
    return await handleApiError(error, "POST /api/products/bulk");
  }
});
