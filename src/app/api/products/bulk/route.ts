import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { productSchema } from "@/lib/validations";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    const categoryNames = [...new Set(body.map((item: any) => item.category_name?.toString().trim()).filter(Boolean))];
    const manufacturerNames = [...new Set(body.map((item: any) => item.manufacturer_name?.toString().trim()).filter(Boolean))];

    if (categoryNames.length === 0 || manufacturerNames.length === 0) {
      return NextResponse.json({ error: "Each product must have a category_name and manufacturer_name." }, { status: 400 });
    }

    // 2. Lookup existing categories and manufacturers (case-insensitive with regex escape)
    const existingCategories = await categoriesCollection.find({
      tenant_id: tenantId,
      name: { $in: categoryNames.map(n => new RegExp(`^${escapeRegExp(n)}$`, 'i')) }
    }).toArray();

    const existingManufacturers = await manufacturersCollection.find({
      tenant_id: tenantId,
      name: { $in: manufacturerNames.map(n => new RegExp(`^${escapeRegExp(n)}$`, 'i')) }
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
        name: name.trim(),
        created_at: new Date()
      }));
      const result = await categoriesCollection.insertMany(catDocs);
      catDocs.forEach((doc, idx) => {
        const id = result.insertedIds[idx];
        if (id) catMap.set(doc.name.toLowerCase(), id.toString());
      });
    }

    // 4. Create missing manufacturers
    const newManufacturers = manufacturerNames.filter(n => !mfgMap.has(n.toLowerCase()));
    if (newManufacturers.length > 0) {
      const mfgDocs = newManufacturers.map(name => ({
        tenant_id: tenantId,
        name: name.trim(),
        created_at: new Date()
      }));
      const result = await manufacturersCollection.insertMany(mfgDocs);
      mfgDocs.forEach((doc, idx) => {
        const id = result.insertedIds[idx];
        if (id) mfgMap.set(doc.name.toLowerCase(), id.toString());
      });
    }

    // 5. Pre-calculate barcode frequencies in the uploaded payload for O(1) duplicate checks
    const payloadBarcodeCounts = new Map<string, number>();
    body.forEach((item: any) => {
      const bc = item.barcode?.toString().trim();
      if (bc) {
        payloadBarcodeCounts.set(bc, (payloadBarcodeCounts.get(bc) || 0) + 1);
      }
    });

    // Fetch existing barcodes in DB
    const incomingBarcodes = Array.from(payloadBarcodeCounts.keys());
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

      const catName = rawItem.category_name?.toString().trim();
      const mfgName = rawItem.manufacturer_name?.toString().trim();

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

      const barcodeStr = rawItem.barcode?.toString().trim() || undefined;

      if (barcodeStr) {
        if (existingBarcodesSet.has(barcodeStr)) {
          errors.push(`Row ${rowNum}: Barcode '${barcodeStr}' already exists in database.`);
          continue;
        }

        if ((payloadBarcodeCounts.get(barcodeStr) || 0) > 1) {
          errors.push(`Row ${rowNum}: Barcode '${barcodeStr}' is duplicated multiple times in the uploaded file.`);
          continue;
        }
      }

      // Format boolean field safely
      const rxVal = rawItem.requires_prescription;
      let requires_prescription = false;
      if (typeof rxVal === 'boolean') {
        requires_prescription = rxVal;
      } else if (typeof rxVal === 'string' || typeof rxVal === 'number') {
        const str = String(rxVal).trim().toLowerCase();
        requires_prescription = ['true', '1', 'yes', 'y'].includes(str);
      }

      const itemToValidate = {
        name: rawItem.name?.toString().trim(),
        generic_name: rawItem.generic_name?.toString().trim() || undefined,
        brand: rawItem.brand?.toString().trim() || undefined,
        category_id,
        manufacturer_id,
        barcode: barcodeStr,
        sku: rawItem.sku?.toString().trim() || undefined,
        schedule_class: rawItem.schedule_class?.toString().trim() || undefined,
        hsn_code: rawItem.hsn_code?.toString().trim() || undefined,
        ndc_code: rawItem.ndc_code?.toString().trim() || undefined,
        strength: rawItem.strength?.toString().trim() || undefined,
        dosage_form: rawItem.dosage_form?.toString().trim() || undefined,
        route_of_administration: rawItem.route_of_administration?.toString().trim() || undefined,
        active_ingredients: rawItem.active_ingredients?.toString().trim() || undefined,
        storage_conditions: rawItem.storage_conditions?.toString().trim() || undefined,
        pregnancy_category: rawItem.pregnancy_category?.toString().trim() || undefined,
        requires_prescription,
        unit_of_measure: rawItem.unit_of_measure?.toString().trim(),
        package_type: rawItem.package_type?.toString().trim() || undefined,
        package_size: rawItem.package_size && !isNaN(Number(rawItem.package_size)) ? Number(rawItem.package_size) : undefined,
        rack_number: rawItem.rack_number?.toString().trim() || undefined,
        minimum_stock: rawItem.minimum_stock && !isNaN(Number(rawItem.minimum_stock)) ? Number(rawItem.minimum_stock) : 0,
        tax_rate: rawItem.tax_rate && !isNaN(Number(rawItem.tax_rate)) ? Number(rawItem.tax_rate) : 0,
        status: rawItem.status?.toString().trim().toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE"
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
        details: errors.slice(0, 50) // Return top 50 errors max
      }, { status: 400 });
    }

    if (productsToInsert.length === 0) {
      return NextResponse.json({ error: "No valid products found to insert." }, { status: 400 });
    }

    // 7. Bulk insert into database
    const result = await productsCollection.insertMany(productsToInsert);

    audit.setAfter({
      bulk_count: result.insertedCount,
      inserted_sample: Object.values(result.insertedIds).slice(0, 5).map(id => id.toString())
    });

    return NextResponse.json({ 
      message: `Successfully uploaded ${result.insertedCount} products.`,
      count: result.insertedCount 
    }, { status: 201 });

  } catch (error: any) {
    return await handleApiError(error, "POST /api/products/bulk");
  }
});
