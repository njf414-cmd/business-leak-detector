import type {
  BusinessLeakDetector,
  DetectorContext,
  DetectorResult,
  DetectedBusinessLeak,
} from "../../../detector-types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseMoney(value: unknown): number | null {
  const cleaned = cleanText(value).replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEarned(value: unknown): boolean {
  return ["exceeded","used","billable","confirmed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSoftwareStorageOverageDetector: BusinessLeakDetector = {
  id: "software.unbilled-data-storage-overage",
  name: "Unbilled Data Storage Overage",
  description: "Detects documented unbilled data storage overage opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Storage Overage","Storage Overage Amount","Storage Usage Status","Storage Overage Billing Status","Usage Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Storage Usage Status"])) return;
      if (isAlreadyBilled(row["Storage Overage Billing Status"])) return;

      const amount = parseMoney(row["Storage Overage Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Storage Overage"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Usage Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.unbilled-data-storage-overage",
        leakType: "Unbilled Data Storage Overage",
        title: `${customerName} has a unbilled data storage overage`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Software Billing",
        severity: amount >= 25000 ? "high" : amount >= 7500 ? "medium" : "low",
        confidence: "high",
        estimatedLoss: amount,
        estimatedRecovery: recovery,
        customerName,
        sourceRowIndex: rowIndex,
        evidence: {
          projectName,
          item,
          amount,
          status: cleanText(row["Storage Usage Status"]),
          billingStatus: cleanText(row["Storage Overage Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "storage_overage",
          detectionReason: "software_storage_overage_not_billed",
        },
      });
    });

    return {
      detectorId: "software.unbilled-data-storage-overage",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
