"use client";

import { useState, useRef } from "react";
import axios from "axios";
import Papa from "papaparse";
import { Upload, X, FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "@/lib/swal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils";

// Keep in sync with MAX_BULK_ROWS in /api/products/bulk
const MAX_BULK_ROWS = 1000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface BulkUploadDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkUploadDialog({ onClose, onSuccess }: BulkUploadDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // Set when some products were saved, so closing the dialog still refreshes the product list
  const onSuccessRef = useRef(false);

  const handleClose = () => {
    if (isUploading) return;
    if (onSuccessRef.current) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const expectedHeaders = [
    "name", "category_name", "manufacturer_name", "unit_of_measure",
    "generic_name", "brand", "barcode", "sku", "schedule_class",
    "hsn_code", "ndc_code", "strength", "dosage_form", "route_of_administration",
    "active_ingredients", "storage_conditions", "pregnancy_category",
    "requires_prescription", "package_type", "package_size", "rack_number",
    "minimum_stock", "tax_rate", "status"
  ];

  const handleDownloadTemplate = () => {
    const exampleRow = [
      "Paracetamol 500mg", "Painkillers", "PharmaCorp", "Tablet",
      "Acetaminophen", "Tylenol", "123456789012", "MED-001", "",
      "3004", "", "500mg", "Tablet", "Oral",
      "Acetaminophen", "Room Temperature", "Category B",
      "FALSE", "Strip", "10", "A1",
      "100", "5", "ACTIVE"
    ];
    
    const csvContent = Papa.unparse([expectedHeaders, exampleRow]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "products_bulk_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processSelectedFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".csv") && !selectedFile.type.includes("csv")) {
      setErrors([
        "Please select a valid CSV file (.csv). If you are using Excel, click 'Save As' and select 'CSV (Comma delimited)' format."
      ]);
      setFile(null);
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrors([`File is too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB). Split it into smaller files.`]);
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setErrors([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
    // Allow re-selecting the same file after removing it or fixing it on disk
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // Tolerate "Category Name", "CATEGORY_NAME" and a UTF-8 BOM from Excel
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_"),
      complete: async (results) => {
        const { data, meta, errors: parseErrors } = results;

        const criticalHeaders = ["name", "category_name", "manufacturer_name", "unit_of_measure"];
        const missingCritical = criticalHeaders.filter(h => !meta.fields?.includes(h));

        if (missingCritical.length > 0) {
          setErrors([
            `File column mismatch! Missing required columns: ${missingCritical.join(", ")}. Please use the template CSV headers.`
          ]);
          setIsUploading(false);
          return;
        }

        if (parseErrors.length > 0) {
          // Papa's row index is 0-based over data rows; +2 gives the spreadsheet row (header is row 1)
          setErrors(parseErrors.map(e => typeof e.row === "number" ? `Row ${e.row + 2}: ${e.message}` : e.message));
          setIsUploading(false);
          return;
        }

        if (data.length === 0) {
          setErrors(["The CSV file contains no data rows."]);
          setIsUploading(false);
          return;
        }

        if (data.length > MAX_BULK_ROWS) {
          setErrors([`The file has ${data.length} rows. Upload at most ${MAX_BULK_ROWS} products per file.`]);
          setIsUploading(false);
          return;
        }

        try {
          const res = await axios.post("/api/products/bulk", data);
          setSuccessCount(res.data.count);

          // Partial success: some rows were skipped (e.g. barcode taken concurrently). Keep the dialog open to show them.
          if (Array.isArray(res.data.details) && res.data.details.length > 0) {
            setErrors([res.data.message, ...res.data.details]);
            setFile(null);
            onSuccessRef.current = true;
            return;
          }

          setIsSuccess(true);
          onSuccessRef.current = true;
          
          Swal.fire({
            icon: "success",
            title: "Success",
            text: res.data.message,
            timer: 3000,
            showConfirmButton: false
          });
          
          setTimeout(() => {
            onSuccess();
          }, 1500);
          
        } catch (err: any) {
          console.error("Bulk upload failed", err);
          if (err.response?.data?.details) {
             const { details, total_errors } = err.response.data;
             const hidden = typeof total_errors === "number" ? total_errors - details.length : 0;
             setErrors(hidden > 0 ? [...details, `…and ${hidden} more error(s). Fix these and upload again.`] : details);
          } else {
             setErrors([err.response?.data?.error || "An unexpected error occurred during upload."]);
          }
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        setErrors([error.message]);
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-upload-title"
        className="bg-canvas text-ink w-full max-w-2xl rounded-lg flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-hairline">
          <h2 id="bulk-upload-title" className="text-tagline text-ink">Bulk Upload Products</h2>
          <Button 
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={isUploading}
            aria-label="Close"
            className="text-ink-48"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="size-8 text-success mb-4" aria-hidden="true" />
              <h3 className="text-tagline text-ink mb-2">Upload Complete!</h3>
              <p className="text-body text-ink-48">Successfully imported <span className="tabular">{successCount}</span> products into medicine catalog.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Alert>
                <p className="font-semibold mb-1">Instructions:</p>
                <ul className="list-disc pl-4 space-y-1 text-ink-80">
                  <li>Download the template CSV below.</li>
                  <li>If using Excel, save your file as <strong className="font-semibold">CSV (Comma delimited) (.csv)</strong>.</li>
                  <li>Required fields: <code className="font-mono">name</code>, <code className="font-mono">category_name</code>, <code className="font-mono">manufacturer_name</code>, <code className="font-mono">unit_of_measure</code>.</li>
                  <li>Missing categories or manufacturers will be created automatically.</li>
                  <li>Up to {MAX_BULK_ROWS} products per file.</li>
                </ul>
              </Alert>

              <div className="flex justify-center">
                <Button variant="secondary" onClick={handleDownloadTemplate}>
                  <Download aria-hidden="true" />
                  Download Template CSV
                </Button>
              </div>

              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "rounded-lg p-8 text-center",
                  isDragOver || file
                    ? "border-2 border-dashed border-primary-focus bg-parchment"
                    : "border border-dashed border-hairline bg-canvas"
                )}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                
                {!file ? (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="size-6 text-ink-48" aria-hidden="true" />
                    <div>
                      <p className="text-body font-semibold text-ink">Click to upload CSV</p>
                      <p className="text-caption text-ink-48 mt-1">or drag and drop your CSV file here</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3"
                    >
                      Browse Files
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="size-6 text-success" aria-hidden="true" />
                    <div>
                      <p className="text-body font-semibold text-ink">{file.name}</p>
                      <p className="text-caption text-ink-48 mt-1 tabular">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setFile(null); setErrors([]); }}
                      className="press cursor-pointer mt-3 text-caption text-destructive hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div role="alert" className="bg-parchment rounded-lg px-4.25 py-3">
                  <div className="flex items-center gap-2 text-caption font-semibold text-ink mb-2">
                    <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
                    <span>Errors found in upload:</span>
                  </div>
                  <ul className="list-disc pl-5 text-caption text-destructive space-y-1 max-h-40 overflow-y-auto">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {!isSuccess && (
          <div className="px-6 py-4 border-t border-hairline flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file}
              loading={isUploading}
            >
              {isUploading ? (
                "Processing..."
              ) : (
                <>
                  <Upload aria-hidden="true" />
                  Upload Data
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
