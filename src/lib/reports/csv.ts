// Client-side CSV download shared by the report pages.
import Papa from "papaparse";

/**
 * Downloads rows as a CSV file. Text cells starting with = + - @ (or tab / CR) are prefixed with ' so
 * spreadsheet apps don't execute them as formulas (product names, invoice numbers etc. are user-entered).
 * Numbers are left as numbers.
 */
export function downloadCSV(rows: Record<string, unknown>[], filenameBase: string) {
  const csv = Papa.unparse(rows, { escapeFormulae: true });
  // BOM so Excel reads UTF-8 (currency symbols, non-Latin product names) correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filenameBase}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
