"use client";

import { useState, useRef } from "react";
import axios from "axios";
import Papa from "papaparse";
import { Upload, X, FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrors([]);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setIsUploading(true);
    setErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data, meta, errors: parseErrors } = results;

        // Basic validation of headers
        const missingHeaders = expectedHeaders.filter(
          h => !meta.fields?.includes(h)
        );
        
        // We only enforce required ones rigidly here
        const criticalHeaders = ["name", "category_name", "manufacturer_name", "unit_of_measure"];
        const missingCritical = criticalHeaders.filter(h => !meta.fields?.includes(h));

        if (missingCritical.length > 0) {
          setErrors([`Missing critical columns: ${missingCritical.join(", ")}`]);
          setIsUploading(false);
          return;
        }

        if (parseErrors.length > 0) {
          setErrors(parseErrors.map(e => `Row ${e.row}: ${e.message}`));
          setIsUploading(false);
          return;
        }

        if (data.length === 0) {
          setErrors(["The CSV file is empty."]);
          setIsUploading(false);
          return;
        }

        try {
          const res = await axios.post("/api/products/bulk", data);
          setSuccessCount(res.data.count);
          setIsSuccess(true);
          
          Swal.fire({
            icon: "success",
            title: "Success",
            text: res.data.message,
            timer: 3000,
            showConfirmButton: false
          });
          
          setTimeout(() => {
            onSuccess();
          }, 2000);
          
        } catch (err: any) {
          console.error("Bulk upload failed", err);
          if (err.response?.data?.details) {
             setErrors(err.response.data.details);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Bulk Upload Products</h2>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">Upload Complete!</h3>
              <p className="text-muted-foreground">Successfully imported {successCount} products.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Instructions:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Download the template CSV below.</li>
                    <li>Fill in your product details. Ensure required fields (name, category_name, manufacturer_name, unit_of_measure) are populated.</li>
                    <li>If a category or manufacturer does not exist, the system will automatically create it.</li>
                    <li>Save the file as CSV and upload it here.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-md hover:bg-secondary/80 transition-colors font-medium text-sm border border-border"
                >
                  <Download className="w-4 h-4" />
                  Download Template CSV
                </button>
              </div>

              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                }`}
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
                    <div className="p-3 bg-secondary rounded-full">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Click to upload CSV</p>
                      <p className="text-sm text-muted-foreground mt-1">or drag and drop your file here</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Browse Files
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-green-100 text-green-700 rounded-full">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button
                      onClick={() => { setFile(null); setErrors([]); }}
                      className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove file
                    </button>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 font-semibold mb-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Errors found in upload:</span>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
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
          <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/30">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Data
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
