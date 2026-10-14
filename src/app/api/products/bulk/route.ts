import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { productSchema, categorySchema, manufacturerSchema } from "@/lib/validations";
import { ZodError } from "zod";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Keeps a single request (validation + insertMany) bounded in time and memory
const MAX_BULK_ROWS = 1000;
// Stand-in id used while validating rows whose category/manufacturer doesn't exist yet
const PLACEHOLDER_ID = "000000000000000000000000";

/** Empty -> fallback; otherwise pass the raw value through so zod reports non-numeric input instead of silently defaulting. */
function numericCell(value: unknown, fallback: number | undefined) {
  if (value === undefined || value === null) return fallback;
  const str = String(value).trim();
  return str === "" ? fallback : str;
}

/** Resolves names (case-insensitively) to ids, creating the missing ones race-safely via upsert. */
async function resolveNames(collectionName: string, tenantId: string, names: string[]) {
  const collection = client.db("pos").collection(collectionName);
  const map = new Map<string, string>();
  if (names.length === 0) return map;

  const findExisting = async () => {
    const docs = await collection.find(
      { tenant_id: tenantId, name: { $in: names.map(n => new RegExp(`^${escapeRegExp(n)}$`, "i")) } },
      { projection: { _id: 1, name: 1 } }
    ).toArray();
    docs.forEach(d => {
      const key = String(d.name).toLowerCase();
      if (!map.has(key)) map.set(key, d._id.toString());
    });
  };

  await findExisting();
  const missing = names.filter(n => !map.has(n.toLowerCase()));
  if (missing.length > 0) {
    const now = new Date();
    // Upsert on the exact name: two concurrent uploads creating the same category can't create duplicates
    // or trip the unique {tenant_id, name} index.
    await collection.bulkWrite(
      missing.map(name => ({
        updateOne: {
          filter: { tenant_id: tenantId, name },
          update: { $setOnInsert: { tenant_id: tenantId, name, created_at: now } },
          upsert: true,
        }
      })),
      { ordered: false }
    );
    await findExisting();
  }
  return map;
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

    if (body.length > MAX_BULK_ROWS) {
      return NextResponse.json({ error: `Too many rows (${body.length}). Upload at most ${MAX_BULK_ROWS} products per file.` }, { status: 400 });
    }

    if (body.some((item: any) => !item || typeof item !== "object" || Array.isArray(item))) {
      return NextResponse.json({ error: "Invalid payload. Each row must be an object." }, { status: 400 });
    }

    const db = client.db("pos");
    const productsCollection = db.collection("products");

    // 1. Unique category / manufacturer names (deduplicated case-insensitively, first spelling wins)
    const uniqueByLower = (values: (string | undefined)[]) => {
      const seen = new Map<string, string>();
      values.forEach(v => { if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v); });
      return [...seen.values()];
    };
    const categoryNames = uniqueByLower(body.map((item: any) => item.category_name?.toString().trim()));
    const manufacturerNames = uniqueByLower(body.map((item: any) => item.manufacturer_name?.toString().trim()));

    if (categoryNames.length === 0 || manufacturerNames.length === 0) {
      return NextResponse.json({ error: "Each product must have a category_name and manufacturer_name." }, { status: 400 });
    }

    // 2. Pre-calculate barcode frequencies in the uploaded payload for O(1) duplicate checks
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
      const existingWithBarcodes = await productsCollection.find(
        { tenant_id: tenantId, barcode: { $in: incomingBarcodes } },
        { projection: { barcode: 1 } }
      ).toArray();
      existingBarcodesSet = new Set(existingWithBarcodes.map(p => p.barcode));
    }

    // 3. Validate every row BEFORE touching the database, so a rejected file leaves no
    //    orphan categories/manufacturers behind.
    const validRows: { rowNum: number; catName: string; mfgName: string; data: any }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < body.length; i++) {
      const rawItem = body[i];
      const rowNum = i + 2; // Assuming row 1 is header

      const catName = rawItem.category_name?.toString().trim();
      const mfgName = rawItem.manufacturer_name?.toString().trim();

      if (!catName || !mfgName) {
        errors.push(`Row ${rowNum}: category_name and manufacturer_name are required.`);
        continue;
      }
      // These names create new records, so hold them to the same rules as the category/manufacturer forms
      if (!categorySchema.safeParse({ name: catName }).success) {
        errors.push(`Row ${rowNum} [category_name]: must be 2-100 characters.`);
        continue;
      }
      if (!manufacturerSchema.safeParse({ name: mfgName }).success) {
        errors.push(`Row ${rowNum} [manufacturer_name]: must be 2-120 characters.`);
        continue;
      }

      const statusStr = rawItem.status?.toString().trim().toUpperCase();
      if (statusStr && statusStr !== "ACTIVE" && statusStr !== "INACTIVE") {
        errors.push(`Row ${rowNum} [status]: must be ACTIVE or INACTIVE.`);
        continue;
      }

      const barcodeStr = rawItem.barcode?.toString().trim() || undefined;

      if (barcodeStr) {
        // Excel turns long numeric barcodes into 1.23457E+11 and the original digits are lost for good
        if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(barcodeStr)) {
          errors.push(`Row ${rowNum}: Barcode '${barcodeStr}' looks like Excel scientific notation. Format the barcode column as Text and re-export the CSV.`);
          continue;
        }
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
        name: rawItem.name?.toString().trim() ?? "",
        generic_name: rawItem.generic_name?.toString().trim() || undefined,
        brand: rawItem.brand?.toString().trim() || undefined,
        category_id: PLACEHOLDER_ID,
        manufacturer_id: PLACEHOLDER_ID,
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
        unit_of_measure: rawItem.unit_of_measure?.toString().trim() ?? "",
        package_type: rawItem.package_type?.toString().trim() || undefined,
        package_size: numericCell(rawItem.package_size, undefined),
        rack_number: rawItem.rack_number?.toString().trim() || undefined,
        minimum_stock: numericCell(rawItem.minimum_stock, 0),
        tax_rate: numericCell(rawItem.tax_rate, 0),
        status: statusStr === "INACTIVE" ? "INACTIVE" : "ACTIVE"
      };

      try {
        const validatedData = productSchema.parse(itemToValidate);
        validRows.push({ rowNum, catName, mfgName, data: validatedData });
      } catch (err: any) {
        // zod v4 exposes validation problems on `issues` (`errors` no longer exists)
        if (err instanceof ZodError) {
          err.issues.forEach((e) => {
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
        details: errors.slice(0, 50), // Return top 50 errors max
        total_errors: errors.length
      }, { status: 400 });
    }

    if (validRows.length === 0) {
      return NextResponse.json({ error: "No valid products found to insert." }, { status: 400 });
    }

    // 4. Resolve / create categories and manufacturers now that the whole file is valid
    const [catMap, mfgMap] = await Promise.all([
      resolveNames("categories", tenantId, categoryNames),
      resolveNames("manufacturers", tenantId, manufacturerNames),
    ]);

    const currentDate = new Date();
    const productsToInsert: any[] = [];
    const rowNumbers: number[] = [];
    for (const row of validRows) {
      const category_id = catMap.get(row.catName.toLowerCase());
      const manufacturer_id = mfgMap.get(row.mfgName.toLowerCase());
      if (!category_id || !manufacturer_id) {
        errors.push(`Row ${row.rowNum}: Failed to resolve category or manufacturer.`);
        continue;
      }
      productsToInsert.push({
        ...row.data,
        category_id,
        manufacturer_id,
        tenant_id: tenantId,
        created_at: currentDate,
      });
      rowNumbers.push(row.rowNum);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed for some items.", details: errors.slice(0, 50) }, { status: 400 });
    }

    // 5. Bulk insert. Unordered so one row losing a barcode race doesn't silently stop the rest;
    //    any such rows are reported back individually.
    let insertedCount = 0;
    let insertedIds: any[] = [];
    const failedRows: string[] = [];
    try {
      const result = await productsCollection.insertMany(productsToInsert, { ordered: false });
      insertedCount = result.insertedCount;
      insertedIds = Object.values(result.insertedIds);
    } catch (err: any) {
      if (!err?.writeErrors && err?.code !== 11000) throw err;
      insertedCount = err.insertedCount ?? err.result?.insertedCount ?? 0;
      insertedIds = Object.values(err.insertedIds ?? err.result?.insertedIds ?? {});
      const writeErrors = Array.isArray(err.writeErrors) ? err.writeErrors : err.writeErrors ? [err.writeErrors] : [];
      writeErrors.forEach((we: any) => {
        const rowNum = rowNumbers[we.index] ?? "?";
        failedRows.push(we.code === 11000
          ? `Row ${rowNum}: Barcode already exists in database.`
          : `Row ${rowNum}: Could not be saved.`);
      });
    }

    audit.setAfter({
      bulk_count: insertedCount,
      failed_count: failedRows.length,
      inserted_sample: insertedIds.slice(0, 5).map(id => id.toString())
    });

    if (insertedCount === 0) {
      return NextResponse.json({ error: "No products were saved.", details: failedRows.slice(0, 50) }, { status: 409 });
    }

    return NextResponse.json({
      message: failedRows.length > 0
        ? `Uploaded ${insertedCount} products. ${failedRows.length} row(s) were skipped.`
        : `Successfully uploaded ${insertedCount} products.`,
      count: insertedCount,
      ...(failedRows.length > 0 ? { details: failedRows.slice(0, 50) } : {})
    }, { status: 201 });

  } catch (error: any) {
    return await handleApiError(error, "POST /api/products/bulk");
  }
});
