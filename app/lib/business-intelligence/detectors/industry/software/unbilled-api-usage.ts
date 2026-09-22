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
  return ["used","exceeded","billable","confirmed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSoftwareApiUsageDetector: BusinessLeakDetector = {
  id: "software.unbilled-api-usage",
  name: "Unbilled API Usage",
  description: "Detects documented unbilled api usage opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","API Usage","API Usage Amount","API Usage Status","API Billing Status","Usage Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["API Usage Status"])) return;
      if (isAlreadyBilled(row["API Billing Status"])) return;

      const amount = parseMoney(row["API Usage Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["API Usage"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Usage Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.unbilled-api-usage",
        leakType: "Unbilled API Usage",
        title: `${customerName} has a unbilled api usage`,
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
          status: cleanText(row["API Usage Status"]),
          billingStatus: cleanText(row["API Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "api_usage",
          detectionReason: "software_api_usage_not_billed",
        },
      });
    });

    return {
      detectorId: "software.unbilled-api-usage",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
