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
  return ["completed","extended","performed","provided"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledBeautyExtensionTimeDetector: BusinessLeakDetector = {
  id: "beauty.unbilled-extension-time",
  name: "Unbilled Extended Service Time",
  description: "Detects documented unbilled extended service time opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["beauty"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Extended Service","Extended Service Amount","Extended Service Status","Extended Service Billing Status","Service Date"],
  },
  supports(profile) {
    return profile.industry === "beauty";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Extended Service Status"])) return;
      if (isAlreadyBilled(row["Extended Service Billing Status"])) return;

      const amount = parseMoney(row["Extended Service Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Extended Service"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Service Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "beauty.unbilled-extension-time",
        leakType: "Unbilled Extended Service Time",
        title: `${customerName} has a unbilled extended service time`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Beauty Billing",
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
          status: cleanText(row["Extended Service Status"]),
          billingStatus: cleanText(row["Extended Service Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "beauty",
          revenueType: "extended_service_time",
          detectionReason: "beauty_extended_service_time_not_billed",
        },
      });
    });

    return {
      detectorId: "beauty.unbilled-extension-time",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
