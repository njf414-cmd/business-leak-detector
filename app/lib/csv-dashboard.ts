import type { Leak } from "./leak-engine";
import type { DetectedBusinessLeak } from "./business-intelligence/detector-types";

export type CsvDashboardResult = {
  success: boolean;
  previewOnly: boolean;
  file: { rowCount: number; rowsAccepted: number; rowsBlocked: number };
  classification: { effectiveIndustry: string; confidence: string };
  mapping: { sourceFields: string[]; availableTargets: string[]; matches: { sourceField: string; targetField: string; confidence: number }[]; rejectedMatches: { sourceField: string; targetField: string }[]; unmappedSourceFields: string[] };
  normalization: { issues: { rowIndex: number; field: string; message: string }[] };
  dataQuality: { issues: { rowIndex: number | null; field: string | null; message: string; severity: string }[] };
  detectorReadiness: { runnableFromFields: number };
  analysis: { performed: boolean; leaks: DetectedBusinessLeak[]; errors: string[]; totalEstimatedLoss: number };
};

export async function requestCsvAnalysis(csvText: string, options: { preview?: boolean; mappings?: Record<string, string>; industry?: string; businessName?: string; signal?: AbortSignal } = {}): Promise<CsvDashboardResult> {
  const form = new FormData();
  form.set("file", new File([csvText], "upload.csv", { type: "text/csv" }));
  if (options.preview) form.set("mode", "preview");
  if (options.mappings) form.set("mappingOverrides", JSON.stringify(options.mappings));
  if (options.industry) form.set("industry", options.industry);
  if (options.businessName) form.set("businessName", options.businessName);
  const response = await fetch("/api/analyze-csv", { method: "POST", body: form, signal: options.signal });
  if (response.redirected || response.status === 401) throw new Error("Your session has expired. Sign in again before uploading.");
  let result;
  try { result = await response.json(); }
  catch { throw new Error("The server did not return an analysis. Check your connection and sign-in, then retry."); }
  if (!response.ok || result?.success !== true) throw new Error(typeof result?.error === "string" ? result.error : "Analysis failed. Please try again.");
  if (
    typeof result.previewOnly !== "boolean" ||
    ![result.file?.rowCount, result.file?.rowsAccepted, result.file?.rowsBlocked,
      result.detectorReadiness?.runnableFromFields].every(value => Number.isInteger(value) && value >= 0) ||
    typeof result.classification?.effectiveIndustry !== "string" ||
    ![result.mapping?.sourceFields, result.mapping?.availableTargets,
      result.mapping?.matches, result.mapping?.unmappedSourceFields,
      result.dataQuality?.issues, result.normalization?.issues,
      result.analysis?.leaks, result.analysis?.errors].every(Array.isArray) ||
    typeof result.analysis?.performed !== "boolean"
  ) throw new Error("Incomplete analysis response. Please try again.");
  return result;
}

export function toDashboardLeaks(result: CsvDashboardResult): Leak[] {
  if (result.previewOnly || !result.analysis.performed) throw new Error("No valid rows were analyzed. Correct the file before saving.");
  if (result.analysis.errors.length) throw new Error("Some detectors failed. Retry before saving this analysis.");
  return result.analysis.leaks.map((leak) => ({
    customer: leak.customerName || "Unknown Customer",
    type: leak.leakType,
    category: ["Lost Lead", "Cancelled Job", "No-Show"].includes(leak.leakType) ? "Lost" : "Recoverable",
    amount: leak.estimatedLoss,
    recovery: leak.estimatedRecovery,
    severity: leak.severity === "critical" || leak.severity === "high" ? "High" : leak.severity === "medium" ? "Medium" : "Low",
    reason: leak.description + (leak.sourceRowIndex === null ? "" : ` (Uploaded data row ${leak.sourceRowIndex + 1}.)`),
    action: leak.recommendedAction || "Review the source record and confirm the next action.",
  }));
}
